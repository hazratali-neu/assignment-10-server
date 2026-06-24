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
        const ticketsCollection = database.collection("tickets");
        const addTicketCollection = database.collection('addTicket');

        // Latest 8 tickets
        app.get('/tickets/latest', async (req, res) => {
            const tickets = await ticketsCollection
                .find()
                .sort({ createdAt: -1 })  // নতুন আগে
                .limit(8)
                .toArray();
            res.send(tickets);
        })
        app.post('/api/addticket', async (req, res) => {
            const data = req.body;
            console.log(data);
            const result = await addTicketCollection.insertOne(data)
            res.send(result)
        })
        // ... আপনার আগের কোড (যেমন: app.post('/api/addticket', ...))

        // এটি যোগ করুন: addTicket কালেকশন থেকে সব টিকিট ফ্রন্টএন্ডে পাঠানোর জন্য
        app.get('/api/addticket', async (req, res) => {
            try {
                const result = await addTicketCollection.find().toArray();
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: "Data fetch" });
            }
        });
         

        // 🟠 PATCH: নির্দিষ্ট ফিল্ড আংশিক বা সম্পূর্ণ আপডেট করার জন্য
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

        // 🔴 DELETE: আইডি অনুযায়ী টিকিট ডিলিট করার জন্য
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


// app.get('/', (req, res) => {
//     res.send('Hello World!')
// })

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})