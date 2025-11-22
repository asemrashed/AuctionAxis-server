const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
require("dotenv").config();
const admin = require("firebase-admin");
const jwt = require("jsonwebtoken");
const port = process.env.PORT;

const serviceAccount = require("./auction-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();
app.use(cors());
app.use(express.json());

const varifyFireToken = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) {
    // console.log('Unauthorized access, no header')
    return res
      .status(401)
      .send({ message: "Unauthorized access, header not found" });
  }
  const token = header.split(" ")[1];
  if (!token) {
    // console.log('Unauthorized access, no token', header)
    return res
      .status(401)
      .send({ message: "Unauthorized access,Token missing" });
  }

  try {
    const tokenDetails = await admin.auth().verifyIdToken(token);
    // console.log(tokenDetails.email)
    req.user_email = tokenDetails.email;
    next();
  } catch {
    return res.status(401).send({ message: "Unauthorized access" });
  }
};

const verifyJWTToken = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) {
    return res.status(401).send({ message: "Unauthorized access, no header" });
  }
  const token = header.split(" ")[1];
  if (!token) {
    return res.status(401).send({ messagae: "Unauthorized access, no entry" });
  }

  jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
    if (err) {
      return res.status(401).send({ messagae: "Unauthorized access" });
    }
    req.decoded_email = decoded.email;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@mycluster.m1axkl4.mongodb.net/?appName=MyCluster`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("Server is running");
});

async function run() {
  try {
    // await client.connect();

    const auctionDB = client.db("auctionDB");
    const productCollection = auctionDB.collection("productCollection");
    const bidsCollection = auctionDB.collection("bidsCollection");
    const usersCollection = auctionDB.collection("usersCollection");

    app.post("/getToken", varifyFireToken, async (req, res) => {
      const email = req.user_email
      const token = jwt.sign({email}, process.env.JWT_SECRET, {
        expiresIn: "7d"
      });
      res.send({ token: token });
    });

    // User APIs
    app.post("/users", async (req, res) => {
      const newUser = req.body;
      const email = newUser.email;
      const query = { email: email };
      console.log(query);
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        res.send({ message: "User already exist" });
      } else {
        const result = await usersCollection.insertOne(newUser);
        res.send(result);
      }
    });
    app.get("/users", async (req, res) => {
      const query = req.body;
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    
  // My Product APIs
    app.get("/products", async (req, res) => {
      // const productFields = { title: 1, price_min:1, price_max:1, image:1}
      // const products= productCollection.find().sort({price_min: -1}).limit(6).project(productFields)
      const products = productCollection.find();
      const result = await products.toArray();
      res.send(result);
    });

    app.get("/products/my-products", verifyJWTToken, async(req, res)=>{
      const seller_email = req.decoded_email
      const query = {email:seller_email}
      const products = await productCollection.find(query).toArray()
      res.send(products)
    })

    app.delete("/products/my-products/:id", async(req, res)=>{
      const {id} = req.params
      const query = {_id: new ObjectId(id)}
      const result = await productCollection.deleteOne(query)
      res.send(result)
    })

    // Product APIs
    app.get("/latest-product", async (req, res) => {
      const products = productCollection
        .find()
        .sort({ created_at: -1 })
        .limit(8);
      const result = await products.toArray();
      res.send(result);
    });

    app.get("/products/:id", async (req, res) => {
      const { id } = req.params;
      let query;
      if (ObjectId.isValid(id)) {
        query = { _id: new ObjectId(id) };
      } else {
        query = { _id: id }; // treat as string id
      }
      const result = await productCollection.findOne(query);
      res.send(result);
    });

    app.post("/products",verifyJWTToken, async (req, res) => {
      const newProduct = req.body;
      newProduct.created_at = new Date().toISOString(); 
      const result = await productCollection.insertOne(newProduct);
      console.log("new product added", result);
      res.send(result);
    });

    app.patch("/products/:id", verifyJWTToken, async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const product = req.body;
      const cursor = {
        $set: {
          status: product.status,
        },
      };

      const result = await productCollection.updateOne(query, cursor);
      res.send(result);
    });

    app.delete("/product/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await productCollection.deleteOne(query);
      console.log("product deleted");
      res.send(result);
    });

    // app.get('/bids', varifyFireToken, async(req, res)=>{
    //     const productId = req.query.productId
    //     const email = req.query.user_email
    //     const query = {}
    //     const user_email = req.user_email
    //     console.log(user_email)
    //     console.log(email)
    //     if(productId){
    //         query.productId = productId;
    //     }
    //     if(email){
    //         query.buyer_email= email;
    //         if(email !== user_email){
    //             return res.status(403).send({ message : 'Forbiden access'})
    //         }
    //     }
    //     const productsBids = bidsCollection.find(query).sort({bid_price: -1})
    //     const result = await productsBids.toArray()
    //     res.send(result)
    // })

    // Bids APIs
    app.get("/bids", verifyJWTToken, async (req, res) => {
      const productId = req.query.productId;
      const email = req.query.user_email;
      const decoded_email = req.decoded_email;
      const query = {};
      if (productId) {
        query.productId = productId;
      }
      if (email) {
        query.buyer_email = email;
        if (email !== decoded_email) {
          return res.status(403).send({ message: "Forbiden access" });
        }
      }
      const bids = bidsCollection.find(query).sort({ bid_price: -1 });
      const result = await bids.toArray();
      res.send(result);
    });

    app.post("/bids", async (req, res) => {
      const newBid = req.body;
      const result = await bidsCollection.insertOne(newBid);
      res.send(result);
    });

    app.get("/bids/:id", async (req, res) => {
      const { id } = req.params;
      const query = { productId: id };
      const result = await bidsCollection.find(query).toArray();
      res.send(result);
    });

    app.patch("/bids/:id", verifyJWTToken, async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const bid = req.body;
      const cursor = {
        $set: {
          status: bid.status,
        },
      };
      const result = await bidsCollection.updateOne(query, cursor);
      res.send(result);
    });

    app.delete("/bids/:id", verifyJWTToken, async (req, res) => {
      const { id } = req.params;
      const cursor = { _id: new ObjectId(id) };
      const result = await bidsCollection.deleteOne(cursor);
      console.log("user deleted");
      res.send(result);
    });

    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, console.log(`Auction server running on port ${port}`));
