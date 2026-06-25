const express = require('express');
var cors = require('cors')
const app = express()
const port = process.env.PORT || 8000
require('dotenv').config()

app.use(cors());
app.use(express.json());
const { ObjectId } = require('mongodb'); // ফাইলের ওপরে এটি নিশ্চিত করুন
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = process.env.MONGO_DB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const database = client.db("onlineTicket");
        const addTicketCollection = database.collection('addTicket');


        app.post('/api/addticket', async (req, res) => {
            const data = req.body;
            console.log(data);
            const result = await addTicketCollection.insertOne(data)
            res.send(result)
        })

        app.get('/api/addticket', async (req, res) => {
            try {
                const result = await addTicketCollection.find().toArray();
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: "Data fetch" });
            }
        });
        app.get('/api/tickets/approved', async (req, res) => {
            try {
                const { from, to, transportType } = req.query;
                let query = { verificationStatus: "approved" };

                if (from) {
                    query.fromLocation = { $regex: from, $options: 'i' };
                }

                if (to) {
                    query.toLocation = { $regex: to, $options: 'i' };
                }

                if (transportType && transportType !== 'All') {
                    query.transportType = transportType;
                }

                const result = await addTicketCollection.find(query).toArray();
                res.send(result);
            } catch (error) {
                console.error("Error fetching approved tickets:", error);
                res.status(500).send({ message: "Internal Server Error" });
            }
        });

        app.patch('/api/addticket/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const updatedData = req.body;

                // _id মঙ্গোডিবিতে মডিফাই করা যায় না, তাই অবজেক্ট থেকে ডিলিট করা হলো
                delete updatedData._id;

                const filter = { _id: new ObjectId(id) };
                const updateDoc = {
                    $set: updatedData,
                };

                const result = await addTicketCollection.updateOne(filter, updateDoc);
                res.status(200).send(result);
            } catch (error) {
                console.error("Error updating ticket:", error);
                res.status(500).send({ success: false, message: "Failed to update ticket" });
            }
        });
        app.delete('/api/addticket/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const filter = { _id: new ObjectId(id) };

                const result = await addTicketCollection.deleteOne(filter);
                res.status(200).send(result);
            } catch (error) {
                console.error("Error deleting ticket:", error);
                res.status(500).send({ success: false, message: "Failed to delete ticket" });
            }
        });

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})