const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const moment = require("moment");
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://assignment-11-118f4.web.app",
      "https://assignment-11-118f4.firebaseapp.com",
    ],
    credentials: true,
  })
);





app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.idf9u.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});



const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  // console.log("value of token in middleware", token);
  if (!token) {
    return res.status(401).send({ message: "not authorized" });
  }
  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    // console.log("value in the token", decoded);
    req.user = decoded;
    next();
  } catch (err) {
    // console.error("Error verifying token:", err);
    return res.status(401).send({ message: "unauthorized" });
  }
};

async function run() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    // await client.connect();
    const roomCollection = client.db("assignment-11").collection("rooms");
    const bookingCollection = client.db("assignment-11").collection("bookings");
    const reviewCollection = client.db("assignment-11").collection("reviews");
    const imageCollection = client.db("assignment-11").collection("images");

    // images
    app.get("/images", async (req, res) => {
      try {
        const cursor = imageCollection.find();
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching images:", error);
        res.status(500).send({ message: "Error fetching images" });
      }
    });

    // auth api
    app.post("/jwt", async (req, res) => {
      try {
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: "5h",
        });
        res
          .cookie("token", token, {
            httpOnly: true,
            secure:process.env.NODE_ENV=== 'production' ,
            sameSite: "none",
            maxAge: 3600,
          })
          .send({ success: true });
      } catch (error) {
        console.error("Error generating token:", error);
        res.status(500).send({ message: "Error generating token" });
      }
    });

    app.post("/logout", async (req, res) => {
      try {
        res.clearCookie("token", { maxAge: 0 }).send({ success: true });
      } catch (error) {
        console.error("Error during logout:", error);
        res.status(500).send({ message: "Error during logout" });
      }
    });

    // rooms
    app.get("/rooms", async (req, res) => {
      const { minPrice, maxPrice } = req.query;
      let filter = {};
      if (minPrice && maxPrice) {
        filter = {
          pricePerNight: { $gte: parseInt(minPrice), $lte: parseInt(maxPrice) },
        };
      } else if (minPrice) {
        filter = { pricePerNight: { $gte: parseInt(minPrice) } };
      } else if (maxPrice) {
        filter = { pricePerNight: { $lte: parseInt(maxPrice) } };
      }
      try {
        const cursor = roomCollection.find(filter).sort({ pricePerNight: 1 });
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching rooms:", error);
        res.status(500).send({ message: "Error fetching rooms" });
      }
    });

    app.get("/rooms/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = {_id: id };
        const result = await roomCollection.findOne(query);

        if (!result) {
          return res.status(404).send({ message: "Room not found" });
        }

        res.send(result);
      } catch (error) {
        console.error("Error fetching room:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // bookings
    app.get("/bookings", async (req, res) => {
      try {
        let query = {};
        if (req.query?.email) {
          query = { email: req.query.email };
        }
        const result = await bookingCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching bookings:", error);
        res.status(500).send({ message: "Error fetching bookings" });
      }
    });

    app.get("/bookings/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { room_id:id };
        const result = await bookingCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching booking:", error);
        res.status(500).send({ message: "Error fetching booking" });
      }
    });








    // New route to get bookings by room_id
    app.get("/bookings/room/:room_id", async (req, res) => {
      try {
        const room_id = req.params.room_id;
        const query = { room_id: room_id };
        const result = await bookingCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching bookings by room:", error);
        res.status(500).send({ message: "Error fetching bookings by room" });
      }
    });

    app.post("/bookings", async (req, res) => {
      try {
        const booking = req.body;
        const result = await bookingCollection.insertOne(booking);
        res.send(result);
      } catch (error) {
        console.error("Error creating booking:", error);
        res.status(500).send({ message: "Error creating booking" });
      }
    });

    // review
    app.get("/reviews", async (req, res) => {
      const { minRating, maxRating } = req.query;
      let filter = {};
      if (minRating && maxRating) {
        filter = {
          rating: { $gte: parseInt(minRating), $lte: parseInt(maxRating) },
        };
      } else if (minRating) {
        filter = { rating: { $gte: parseInt(minRating) } };
      } else if (maxRating) {
        filter = { rating: { $lte: parseInt(maxRating) } };
      }
      try {
        const result = await reviewCollection.find(filter).sort({ timestamp: -1 }).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching reviews:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });


    app.get("/reviews/:review_id", async (req, res) => {
      try {
        const review_id = req.params.review_id;
        const query = { review_id: review_id };
        const result = await reviewCollection.findOne(query);
        res.send(result);
      } catch (error) {
        console.error("Error fetching review:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.delete('/booking/cancle/:id', async(req,res)=>{
      const id = req.params.id
      const query = {_id: new ObjectId(id)}
      const result = await bookingCollection.deleteOne(query)
      res.send(result)
    })


  app.patch('/booking/update/:id', async (req, res) => {
      const id = req.params.id; // Get the booking ID from the URL parameter
      const updatedData = req.body; // Get the updated data from the request body
    
      // Find the booking by room_id (id in the URL)
      const query = { room_id: id };
    
      // Define the update operation with $set to update specific fields
      const updateDoc = {
        $set: {
          checkInDate: updatedData.checkInDate,
          checkOutDate: updatedData.checkOutDate,
          numRooms: updatedData.numRooms,
          numAdults: updatedData.numAdults,
          numChildren: updatedData.numChildren,
          totalCost: updatedData.totalCost,
          room_id: updatedData.room_id,
          pricePerNight: updatedData.pricePerNight,
        },
      };
    
      const options = { upsert: false }; // Set upsert to false, it will not create a new document if not found
    
      try {
        // Perform the update operation on the booking collection
        const result = await bookingCollection.updateOne(query, updateDoc, options);
    
        if (result.matchedCount > 0) {
          // If matched, send a success response
          res.send({ message: "Booking updated successfully", result });
        } else {
          // If no matching record was found, send an error
          res.status(404).send({ message: "Booking not found" });
        }
      } catch (error) {
        console.error("Error updating booking:", error);
        res.status(500).send({ message: "Failed to update booking", error });
      }
    });

    app.get('/eachReview/:id', async (req, res) => {
      try {
        const id = req.params.id;  // Extract room ID from the URL parameters
        // console.log(id);  // Log the room ID for debugging
    
        const query = { room_id: id };  // Create the query to match room_id
        const result = await reviewCollection.find(query).toArray();  // Fetch all reviews for the room
    
        res.send(result);  // Send the result back to the client
      } catch (error) {
        console.error("Error fetching reviews:", error);  // Log the error for debugging
        res.status(500).send({ message: "Internal server error" });  // Return an error response
      }
    });
    


    app.post("/reviews", async (req, res) => {
      try {
        const review = req.body;
        const result = await reviewCollection.insertOne(review);
        res.send(result);
      } catch (error) {
        console.error("Error creating review:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

  } catch (error) {
    console.error("Database connection error:", error);
    res.status(500).send({ message: "Database connection error" });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello this this Rian");
});

app.listen(port, () => {
  console.log(`hotel booking server is running on port ${port}`);
});