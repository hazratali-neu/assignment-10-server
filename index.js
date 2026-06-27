const express = require('express');
var cors = require('cors')
const app = express()
const port = process.env.PORT || 8000
require('dotenv').config()

app.use(cors());
app.use(express.json());
const { ObjectId } = require('mongodb');
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = process.env.MONGO_DB_URI;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();

        const database = client.db("onlineTicket");
        const addTicketCollection = database.collection('addTicket');
        const bookingsCollection = database.collection('bookings');
        const usersCollection = database.collection('user');
        const transactionsCollection = database.collection('transactions');

    
        
        app.post('/api/addticket', async (req, res) => {
            const data = req.body;
            const result = await addTicketCollection.insertOne(data)
            res.send(result)
        })

        app.get('/api/addticket', async (req, res) => {
            try {
                const { email } = req.query;
                let query = { isHidden: { $ne: true } };
                if (email) query.vendorEmail = email;
                const result = await addTicketCollection.find(query).toArray();
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: "Data fetch error" });
            }
        });

        app.get('/api/tickets/approved', async (req, res) => {
            try {
                const { from, to, transportType } = req.query;
                let query = { verificationStatus: "approved", isHidden: { $ne: true } };
                if (from) query.fromLocation = { $regex: from, $options: 'i' };
                if (to) query.toLocation = { $regex: to, $options: 'i' };
                if (transportType && transportType !== 'All') query.transportType = transportType;
                const result = await addTicketCollection.find(query).toArray();
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: "Internal Server Error" });
            }
        });

        app.get('/api/tickets/advertised', async (req, res) => {
            try {
                const result = await addTicketCollection.find({ 
                    verificationStatus: "approved",
                    $or: [{ isAdvertised: true }, { isAdvertised: "true" }] 
                }).toArray();
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: "Server Error" });
            }
        });

        app.get('/api/tickets/:id', async (req, res) => {
            try {
                const id = req.params.id;
                if (id.length !== 24) return res.status(400).send({ message: "Invalid ID" });
                const query = { _id: new ObjectId(id) };
                const result = await addTicketCollection.findOne(query);
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: "Failed to fetch ticket details" });
            }
        });

        app.patch('/api/addticket/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const updatedData = req.body;
                delete updatedData._id;
                const result = await addTicketCollection.updateOne({ _id: new ObjectId(id) }, { $set: updatedData });
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send({ success: false, message: "Failed to update ticket" });
            }
        });

        app.delete('/api/addticket/:id', async (req, res) => {
            try {
                const result = await addTicketCollection.deleteOne({ _id: new ObjectId(req.params.id) });
                res.status(200).send(result);
            } catch (error) {
                res.status(500).send({ success: false, message: "Failed to delete ticket" });
            }
        });

        app.post('/api/bookings', async (req, res) => {
            const bookingData = req.body;
            const vendor = await usersCollection.findOne({ email: bookingData.vendorEmail });
            if (vendor && (vendor.role === 'fraud' || vendor.isFraud === true)) {
                return res.status(403).json({ success: false, message: "This vendor is banned!" });
            }
            bookingData.status = "pending";
            bookingData.createdAt = new Date();
            const result = await bookingsCollection.insertOne(bookingData);
            res.status(201).send(result);
        });

        app.get('/api/bookings', async (req, res) => {
            const { email } = req.query;
            const result = await bookingsCollection.find({ userEmail: email }).toArray();
            res.status(200).send(result);
        });

        app.get('/api/vendor/bookings', async (req, res) => {
            const { email } = req.query;
            const result = await bookingsCollection.find({ vendorEmail: email }).toArray();
            res.status(200).send(result);
        });

        app.patch('/api/bookings/vendor-update', async (req, res) => {
            const { bookingId, action } = req.body;
            const result = await bookingsCollection.updateOne({ _id: new ObjectId(bookingId) }, { $set: { status: action } });
            res.status(200).json(result);
        });

        app.patch('/api/bookings/update-status', async (req, res) => {
            const { bookingId, status } = req.body;
            const booking = await bookingsCollection.findOne({ _id: new ObjectId(bookingId) });
            await bookingsCollection.updateOne({ _id: new ObjectId(bookingId) }, { $set: { status: status } });
            await addTicketCollection.updateOne({ _id: new ObjectId(booking.ticketId) }, { $inc: { quantity: -booking.bookingQuantity } });
            res.status(200).json({ message: "Updated!" });
        });
        app.get('/api/users', async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.status(200).send(result);
        });

        app.patch('/api/users/:id/role', async (req, res) => {
            const result = await usersCollection.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { role: req.body.role } });
            res.status(200).send(result);
        });

        app.patch('/api/users/:id/fraud', async (req, res) => {
            await usersCollection.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { role: 'fraud', isFraud: true } });
            await addTicketCollection.updateMany({ vendorEmail: req.body.email }, { $set: { isHidden: true } });
            res.status(200).send({ success: true });
        });

        app.post('/api/transactions', async (req, res) => {
            const result = await transactionsCollection.insertOne({ ...req.body, paymentDate: new Date() });
            res.status(201).send(result);
        });

        app.get('/api/transactions', async (req, res) => {
            const result = await transactionsCollection.find({ userEmail: req.query.email }).toArray();
            res.status(200).send(result);
        });

        app.get('/api/vendor/revenue-overview', async (req, res) => {
            const email = req.query.email;
            const totalTicketsCount = await addTicketCollection.countDocuments({ vendorEmail: email });
            const paidBookings = await bookingsCollection.find({ vendorEmail: email, status: "paid" }).toArray();
            let totalTicketsSold = 0;
            let totalRevenue = 0;
            const chartData = paidBookings.map(b => {
                totalTicketsSold += Number(b.bookingQuantity);
                totalRevenue += Number(b.totalPrice);
                return { name: b.title.substring(0, 10), Revenue: Number(b.totalPrice), Quantity: Number(b.bookingQuantity) };
            });
            res.status(200).json({ totalTicketsAdded: totalTicketsCount, totalTicketsSold, totalRevenue, chartData });
        });

        app.get('/api/admin/tickets/approved', async (req, res) => {
            const result = await addTicketCollection.find({ verificationStatus: "approved" }).toArray();
            res.send(result);
        });

        app.patch('/api/admin/tickets/advertise/:id', async (req, res) => {
            const count = await addTicketCollection.countDocuments({ isAdvertised: true });
            if (req.body.isAdvertised === true && count >= 6) return res.status(400).json({ message: "Limit 6!" });
            const result = await addTicketCollection.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { isAdvertised: req.body.isAdvertised } });
            res.status(200).send({ success: true, result });
        });

        await client.db("admin").command({ ping: 1 });
        console.log("Connected to MongoDB!");
    } finally { }
}
run().catch(console.dir);

app.get('/', (req, res) => { res.send('Hello World!') })
app.listen(port, () => { console.log(`Listening on port ${port}`) })