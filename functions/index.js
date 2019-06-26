const firebase = require("firebase");
const functions = require("firebase-functions");
const firebaseConfig = {};
firebase.initializeApp(firebaseConfig);
const admin = require("firebase-admin");
admin.initializeApp();
const app = require("express")();
const db = admin.firestore();

// auth middleware
const auth = (req, res, next) => {
  let idToken;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    idToken = req.headers.authorization.split("Bearer ")[1];
  } else {
    return res.status(403).json({ error: "No token found" });
  }
  admin
    .auth()
    .verifyIdToken(idToken)
    .then(decodedToken => {
      req.user = decodedToken;
      return db
        .collection("users")
        .where("userId", "==", req.user.uid)
        .limit(1)
        .get();
    })
    .then(info => {
      console.log(info);
      req.user.handle = info.docs[0].data().handle;
      return next();
    })
    .catch(err => {
      console.error("Error while verifying token ", err);
      return res.status(403).json(err);
    });
};
// end of auth middleware

app.get("/screams", (req, res) => {
  db.collection("screams")
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

app.post("/screams", auth, (req, res) => {
  const newScream = {
    body: req.body.body,
    userhandle: req.body.userhandle,
    createdAt: new Date().toISOString(),
    userhandle: req.user.handle
  };
  db.collection("screams")
    .add(newScream)
    .then(doc => {
      res.json({ message: `document ${doc.id} created successfully` });
    })
    .catch(err => {
      res.status(500).json({ error: "something went wrong" });
      console.error(err);
    });
});

// helper function for empty string
const isEmpty = str => {
  if (str.trim() === "") {
    return true;
  } else {
    return false;
  }
};

// helper function for email validation
const isEmail = email => {
  const regEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  if (email.match(regEx)) return true;
  else return false;
};

// signup route
app.post("/signup", (req, res) => {
  const newUser = {
    email: req.body.email,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    handle: req.body.handle
  };
  // validation
  let errors = {};
  if (isEmpty(newUser.email)) {
    errors.email = "Email must not be empty";
  } else if (!isEmail(newUser.email)) {
    errors.email = "Must be a valid email";
  }
  if (isEmpty(newUser.password)) {
    errors.password = "Password must not be empty";
  } else if (newUser.password !== newUser.confirmPassword) {
    errors.password = "Passwords must match";
  }
  if (isEmpty(newUser.handle)) {
    errors.handle = "Handle must not be empty";
  }
  if (Object.keys(errors).length > 0) {
    return res.status(400).json(errors);
  }
  // end of validation

  let token, userId;
  db.doc(`/users/${newUser.handle}`)
    .get()
    .then(doc => {
      if (doc.exists) {
        return res.status(400).json({ handle: "this handle is already taken" });
      } else {
        return firebase
          .auth()
          .createUserWithEmailAndPassword(newUser.email, newUser.password);
      }
    })
    .then(data => {
      userId = data.user.uid;
      return data.user.getIdToken();
    })
    .then(tokenId => {
      token = tokenId;
      const userCredentials = {
        handle: newUser.handle,
        email: newUser.email,
        createdAt: new Date().toISOString(),
        userId
      };
      return db.doc(`/users/${newUser.handle}`).set(userCredentials);
    })
    .then(() => {
      return res.status(201).json({ token });
    })
    .catch(err => {
      if (err.code === "auth/email-already-in-use") {
        return res.status(400).json({ error: "Email is already in use" });
      } else {
        console.log(err);
        return res.status(500).json({ error: err.code });
      }
    });
});

// login route
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  let errors = {};
  if (isEmpty(email)) {
    errors.email = "Email must not be empty";
  } else if (isEmpty(password)) {
    errors.password = "Password must not be empty";
  }
  if (Object.keys(errors).length > 0) {
    return res.status(400).send(errors);
  }

  firebase
    .auth()
    .signInWithEmailAndPassword(email, password)
    .then(data => {
      return data.user.getIdToken();
    })
    .then(token => {
      return res.status(201).send({ token });
    })
    .catch(err => {
      if (err.code === "auth/user-not-found") {
        return res
          .status(403)
          .send({ general: "Invalid user email and password" });
      } else return res.status(500).send(err.code);
    });
});

exports.api = functions.https.onRequest(app);
