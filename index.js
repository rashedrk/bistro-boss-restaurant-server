const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const cors = require('cors');
const port = process.env.PORT || 5000;
require('dotenv').config()

// middle ware 
app.use(cors());
app.use(express.json());

const verifyJWT = (req,res,next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({error : true, message: 'unauthorized access'})
    }
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if(err){
            return res.status(401).send({error : true, message: 'unauthorized access'})
        }
        req.decoded = decoded;
        next();
    });
}

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qrkrfrq.mongodb.net/?retryWrites=true&w=majority`;

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

        const menuCollection = client.db("bistroBossRes").collection("menu");
        const reviewsCollection = client.db("bistroBossRes").collection("reviews");
        const cartCollection = client.db("bistroBossRes").collection("carts");
        const usersCollection = client.db("bistroBossRes").collection("users");

        //jwt
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({token});
        })

        //verify admin
        const verifyAdmin = (req,res,next) => {
            const email = req.decoded.email;
            const query = {email: email};
            const user = usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                res.status(403).send({error: true, message: 'forbidden access'})
            }
            next();
        }

        //get menu data
        app.get('/menu', async (req, res) => {
            const result = await menuCollection.find().toArray();
            res.send(result);
        });
        app.get('/reviews', async (req, res) => {
            const result = await reviewsCollection.find().toArray();
            res.send(result);
        });

        //add items to cart
        app.post('/carts', async (req, res) => {
            const item = req.body;
            const result = await cartCollection.insertOne(item);
            res.send(result);
        });

        // get cart items 
        app.get('/carts',verifyJWT, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([]);
            }
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({error : true, message: 'Forbidden access'})
            }
            const query = { email: email };
            const result = await cartCollection.find(query).toArray();
            res.send(result)
        });

        // delete cart items 
        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartCollection.deleteOne(query);
            res.send(result);
        })


        //add user info
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists' });
            }
            const result = await usersCollection.insertOne(user);
            res.send(result)
        })

        //get user info / all user
        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })

        //update user role / admin role
        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateUser = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updateUser);
            res.send(result);
        })

        //verify if user is admin
        app.get('/users/admin/:email', verifyJWT, async(req,res) => {
            const email = req.params.email;
            const query = {email: email};
            if ( req.decoded.email !== email) {
                res.send({admin: false});
            }
            const user = await usersCollection.findOne(query);
            // console.log(user);
            const result = {admin : user?.role === 'admin'};
            // console.log(result);
            res.send(result);
        })

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
    res.send("bistro boos server is running");
})

app.listen(port, () => {
    console.log(`bistro boss is running at ${port}`);
})