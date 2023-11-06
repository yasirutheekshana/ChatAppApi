const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const functions = require("firebase-functions");

const app = express();
const port = 8000;
const cors = require("cors");
app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(passport.initialize());
const jwt = require("jsonwebtoken");

mongoose
  .connect("mongodb+srv://yasirutheekshanadev:yasiru@cluster0.ivxnbuh.mongodb.net/", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to Mongo Db");
  })
  .catch((err) => {
    console.log("Error connecting to MongoDb", err);
  });

app.listen(port, () => {
  console.log("Server running on port 8000");
});

const User = require("./models/user");
const Message = require("./models/message");
const { createFactory } = require("react");

//endpoint for registration of the user
app.post("/register", (req, res) => {
  const { name, email, password, image } = req.body;

  const newUser = new User({ name, email, password, image });

  newUser
    .save()
    .then(() => {
      res.status(200).json({ message: "User registered successfully" });
    })
    .catch((err) => {
      console.log("Error registering user", err);
      res.status(500).json({ error: "Internal Server Error" });
    });
});

//create a token for the user
const createToken = (userId) => {
  const payload = {
    userId: userId,
  };

  const token = jwt.sign(payload, "Q$r2K6W8n!jCW%Zk", { expiresIn: "1h" });

  return token;
};

//endpoint for user login
app.post("/login", (req, res) => {

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(404).json({ message: "Email and Passwrod are required" })
  }

  User.findOne({ email }).then((user) => {

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    if (user.password !== password) {
      return res.status(404).json({ message: "Invalid password" })
    }

    const { _id: userId, name } = user;
    const token = createToken(user._id);
    res.status(200).json({ token, userId, name });

  }).catch((error) => {
    console.log("error in finding user", error);
    res.status(500).json({ message: "Internal Server Error" })
  });
});

//endpoint to get current user
app.get('/user/:userId', (req, res) => {
  const loggedInUserId = req.params.userId;

  User.findById(loggedInUserId)
    .then((user) => {
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.status(200).json(user);
    })
    .catch((error) => {
      console.error('Error retrieving user data:', error);
      res.status(500).json({ message: 'Error retrieving user data' });
    });
});

//endpoint to access all the users accpete current user
app.get('/users/:userId', (req, res) => {
  const loggedInUserId = req.params.userId;

  User.find({ _id: { $ne: loggedInUserId } }).then((users) => {
    res.status(200).json(users)
  })
    .catch((error) => {
      console.log("Error retrieving users", error);
      res.status(500).json({ message: "Error retrieving users" });
    })
});

//endpoint to sent friendRequests
app.post("/friend-requests", async (req, res) => {
  const { currentUserId, selectedUserId } = req.body;

  try {
    //update recepients friendReq array
    await User.findByIdAndUpdate(selectedUserId, {
      $push: { freindRequests: currentUserId },
    });

    //update sender sent friendReq array
    await User.findByIdAndUpdate(currentUserId, {
      $push: { sentFriendRequests: selectedUserId },
    });
    res.sendStatus(200);

  } catch (error) {
    res.status(500);
  }
});

//endpoint to show friend requests
app.get("/friend-request/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).populate("freindRequests", "name email image").lean();

    const freindRequest = user.freindRequests;
    res.json(freindRequest);

  } catch (error) {
    console.log("error", error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

//endpoint to accept request
app.post("/friend-request/accept", async (req, res) => {
  try {
    const { senderId, recepientId } = req.body;

    const sender = await User.findById(senderId);
    const recepient = await User.findById(recepientId);

    sender.friends.push(recepientId);
    recepient.friends.push(senderId);

    recepient.freindRequests = recepient.freindRequests.filter(
      (request) => request.toString() !== senderId.toString()
    );

    sender.sentFriendRequests = sender.sentFriendRequests.filter(
      (request) => request.toString() !== recepientId.toString()
    );

    await sender.save();
    await recepient.save();

    res.status(200).json({ message: "friend request accepted" })
  } catch (error) {
    console.log("error", error);
    res.status(500).json({ message: 'Internal server error' });
  }
})

//endpoint to chats screen
app.get("/accepted-friends/:userId", async(req, res) => {
  try {
    const {userId} = req.params;
    const user = await User.findById(userId).populate(
      "friends",
      "name email image"
    )
    const acceptedFriend = user.friends;
    res.json(acceptedFriend)
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Internal server error' });
  }
})

const multer = require("multer");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "files/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

//endpoint to post messages and store
app.post("/messages", upload.single("imageFile"), async (req, res) => {
  try {
    const {senderId, recepientId, messageType, messageText} = req.body;
    
    console.log("Uploaded File:", req.file);
    console.log("Request Body:", req.body);

    const newMessage = new Message({
      senderId,
      recepientId,
      messageType,
      message:messageText,
      timeStamp: new Date(),
      imageUrl: messageType === "image" ? req.file.path : null,
    });

    await newMessage.save();

    res.status(200).json({message: "message sent successfully"});
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Internal server error' });
  }
})

//endpoint to get the userDetails to design the chat room header
app.get("/user/:userId", async(req, res) => {
  try {
    const {userId} = req.params;

    const recepientId = await User.findById(userId);

    res.json(recepientId);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Internal server error' });
  }
})

//endpoint to fecth a messages in the chat room
app.get("/messages/:senderId/:recepientId", async(req, res) => {
  try {
    const {senderId, recepientId} = req.params;
    const messages = await Message.find({
      $or: [
        {senderId:senderId, recepientId:recepientId},
        {senderId:recepientId, recepientId:senderId}
      ]
    }).populate("senderId","_id name");

    res.json(messages);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Internal server error' });
  }
})

//endpoint to delete messages
app.post("/deleteMessages", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(404).json({ message:"Invalid req body"});
    }
    
    await Message.deleteMany({_id: { $in: messages} });

    res.json({ message: "Message deleted successfully"});
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Internal server error' });
  }
})

app.get("/friend-requests/sent/:userId",async(req,res) => {
  try{
    const {userId} = req.params;
    const user = await User.findById(userId).populate("sentFriendRequests","name email image").lean();

    const sentFriendRequests = user.sentFriendRequests;

    res.json(sentFriendRequests);
  } catch(error){
    console.log("error",error);
    res.status(500).json({ error: "Internal Server" });
  }
})

app.get("/friends/:userId",(req,res) => {
  try{
    const {userId} = req.params;

    User.findById(userId).populate("friends").then((user) => {
      if(!user){
        return res.status(404).json({message: "User not found"})
      }

      const friendIds = user.friends.map((friend) => friend._id);

      res.status(200).json(friendIds);
    })
  } catch(error){
    console.log("error",error);
    res.status(500).json({message:"internal server error"})
  }
});

exports.api = functions.https.onRequest(app);
