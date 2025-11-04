const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
require('dotenv').config()
const port = process.env.PORT || 5000;

const app = express()
app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@mycluster.m1axkl4.mongodb.net/?appName=MyCluster`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

app.get('/', (req, res)=>{
    res.send('Server is running')
})

async function run(){
    try{
        await client.connect();

        const auctionDB = client.db("auctionDB")
        const productCollection = auctionDB.collection("productCollection")
        const bidsCollection = auctionDB.collection("bidsCollection")
        const usersCollection = auctionDB.collection("usersCollection")

        app.post('/users', async(req, res)=>{
            const newUser = req.body;
            const email = newUser.email
            const query = {email : email}
            console.log(query);
            const existingUser = await usersCollection.findOne(query);
            if(existingUser){
                res.send({message:"User already exist"})
            }else{
                const result = await usersCollection.insertOne(newUser)
                res.send(result)
            }
        })
        app.get('/users', async(req, res)=>{
            const query = req.body
            const result = await usersCollection.find().toArray()
            res.send(result)
        })

        app.get('/products', async(req, res)=>{
            // const productFields = { title: 1, price_min:1, price_max:1, image:1}
            // const products= productCollection.find().sort({price_min: -1}).limit(6).project(productFields)
            const products= productCollection.find()
            const result = await products.toArray()
            res.send(result)
        })

        app.get('/latest-product', async(req, res)=>{
            const products = productCollection.find().sort({created_at:-1}).limit(6)
            const result = await products.toArray()
            res.send(result)
        })


        app.get('/products/:id', async(req, res)=>{
            const {id} = req.params;
            const query = {_id: id};
            const result = await productCollection.findOne(query);
            res.send(result)
        })

        app.post('/products', async(req, res)=>{
            const newProduct = req.body
            const result = await productCollection.insertOne(newProduct)
            console.log(result)
            res.send(result)
        })

        app.patch('/products/:id', async(req, res)=>{
            const {id} = req.params;
            const query = {_id: id}
            const product = req.body;
            const cursor = {$set:{
                status: product.status
            }}

            const result = await productCollection.updateOne(query, cursor)
            console.log(`${product.name} is updated`)
            res.send(result)
        })

        app.delete('/product/:id', async(req,res)=>{
            const {id} = req.params;
            const query = {_id: new ObjectId(id)}
            const result = await productCollection.deleteOne(query)
            console.log('product deleted')
            res.send(result)
        })

        app.get('/bids', async(req, res)=>{
            const productId = req.query.productId
            const email = req.query.user_email
            const query = {}
            if(productId){
                query.productId = productId;
            }
            if(email){
                query.buyer_email= email;
            }
            const productsBids = bidsCollection.find(query).sort({bid_price: -1})
            const result = await productsBids.toArray()
            res.send(result)
        })

        app.post('/bids', async(req, res)=>{
            const newBid = req.body;
            const result = await bidsCollection.insertOne(newBid);
            res.send(result)
        })

        app.get('/bids/:id', async(req, res)=>{
            const {id} = req.params
            const query = {_id: new ObjectId(id)}
            const result = await bidsCollection.find(query).toArray()
            res.send(result)
        })

        app.patch('/bids/:id', async(req, res)=>{
            const {id}= req.params;
            const query = {_id: new ObjectId(id)}
            const bid = req.body;
            const cursor= {$set:{
                status: bid.status
            }}
            const result = await bidsCollection.updateOne(query, cursor)
            res.send(result)
        })

        app.delete('/bids/:id', async(req, res)=>{
            const {id} = req.params;
            const cursor = {_id: new ObjectId(id)}
            const result = await bidsCollection.deleteOne(cursor)
            console.log('user deleted')
            res.send(result)
        })

        await client.db("admin").command({ping:1})
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    }
    finally{

    }
}
run().catch(console.dir)

app.listen(port, console.log(`Auction server running on port ${port}`))
