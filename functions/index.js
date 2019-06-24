const firebase = require("firebase");
const functions = require("firebase-functions");
const firebaseConfig = {
  apiKey: "AIzaSyDZuRL0F44DYvPTbSDGnwHEuwzOhDKGnFI",
  authDomain: "socialape-eb26e.firebaseapp.com",
  databaseURL: "https://socialape-eb26e.firebaseio.com",
  projectId: "socialape-eb26e",
  storageBucket: "socialape-eb26e.appspot.com",
  messagingSenderId: "1077056495849",
  appId: "1:1077056495849:web:72a85426e252c4f6"
};
firebase.initializeApp(firebaseConfig);
const admin = require("firebase-admin");
admin.initializeApp();
const app = require("express")();

app.get("/screams", (req, res) => {
  admin
    .firestore()
    .collection("screams")
    .orderBy("createdAt", "desc")
    .get()
    .then(data => {
      let screams = [];
      data.forEach(doc => {
        screams.push({ screamId: doc.id, ...doc.data() });
      });
      return res.json(screams);
    })
    .catch(err => {
      console.error(err);
    });
});

app.post("/screams", (req, res) => {
  const newScream = {
    body: req.body.body,
    userhandle: req.body.userhandle,
    createdAt: new Date().toISOString()
  };
  admin
    .firestore()
    .collection("screams")
    .add(newScream)
    .then(doc => {
      res.json({ message: `document ${doc.id} created successfully` });
    })
    .catch(err => {
      res.status(500).json({ error: "something went wrong" });
      console.error(err);
    });
});
exports.helloWorld = functions.https.onRequest((request, response) => {
  response.send("Hello from Firebase!");
});

// signup route
app.post("/signup", (req, res) => {
  const newUser = {
    email: req.body.email,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    handle: req.body.handle
  };

  // TODO validate data

  firebase
    .auth()
    .createUserWithEmailAndPassword(newUser.email, newUser.password)
    .then(data => {
      return res
        .status(200)
        .json({ message: `user ${data.user.uid} signed up successfully` });
    })
    .catch(err => {
      console.error(err);
      //return res.status(500).json({ error: err.code, err: err });
    });
});

exports.api = functions.https.onRequest(app);
