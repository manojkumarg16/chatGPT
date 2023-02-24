const express = require("express");
const passport = require("passport");
const app = express();
const session = require("express-session");
const fileUpload = require("express-fileupload");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { Strategy } = require("passport-openidconnect");
const cors = require("cors");
const { Configuration, OpenAIApi } = require("openai");
const { validateFileSize } = require("./helper");
require("dotenv").config();

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const OKTA_CLIENT_ID = process.env.OKTA_CLIENT_ID;
const OKTA_CLIENT_SECRET = process.env.OKTA_CLIENT_SECRET
const OKTA_CLIENT_ISSUER = process.env.OKTA_CLIENT_ISSUER;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const corsOptions = {
    origin: "*",
    methods: "GET, POST",
    optionsSuccessStatus: 200
}

app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow_Headers", "X-Requested-With,content-type");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Credentials", false);
    next();
});

app.use(express.json());
app.use(express.urlencoded());
app.use(cors(corsOptions));
app.use(fileUpload());
app.use(session({
    resave: false,
    saveUninitialized: true,
    secret: "SECRET"
}));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, cb) => {
    cb(null, user)
});
passport.deserializeUser((obj, cb) => {
    cb(null, obj)
});


//CHATGPT
const configuration = new Configuration({
    apiKey : OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

app.post("/api/chat", async(req,res) => {
    console.log(req.body.data);
    let result;
    const searchValue = req.body.data;
    try{
        const completion = await openai.createCompletion({
            model: "text-davinci-003",
            prompt: searchValue,
            max_tokens: 256,
        });
        result = completion.data.choices[0].text;
        console.log(completion.data.choices[0].text);
        return res.status(200).json({
            data: result
        })
    }
    catch(error){
        console.log(JSON.stringify(error))
    }
});

app.get("/login/failed", (req, res) => {
    console.log("iniside login failed");
    return res.status(401).json({
        success: false,
        message: "failure"
    })
});

app.get("/login/success", (req, res) => {
    console.log("iniside login success");
    if(req.user) {
        return res.status(200).json({
            success: false,
            message: "success",
            user: req.user
        })
    }
});


//GOOGLE
var userProfile;
passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
},
    (accessToken, refreshToken, profile, done) => {
        console.log("Access Token", accessToken)
        console.log(profile);
        userProfile = profile;
        return done(null, userProfile)
    }
));

app.get("auth/google", cors(corsOptions), passport.authenticate("google", { scope: ["profile", "email"] }))

app.get("/auth/google/callback", cors(corsOptions), passport.authenticate("google", { failureRedirect : "/loginfailed"} ),
    (req,res) => {
        console.log("here", userProfile);
        res.redirect("http://localhost:3000")
    }
);

//OKTA
passport.use("oidc", new Strategy({
    issuer: OKTA_CLIENT_ISSUER,
    authorizationURL: "https://dev-58928055.okta.com/oauth2/default/v1/authorize",
    tokenURL: "https://dev-58928055.okta.com/oauth2/default/v1/token",
    userInfoURL: "https://dev-58928055.okta.com/oauth2/default/v1/userinfo",
    clientID: OKTA_CLIENT_ID,
    clientSecret: OKTA_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/authorization-code/callback",
    scope: "openid profile"
  }, (issuer, profile, done) => {
    userProfile = profile;
    return done(null, profile);
  })
);

app.get("/login", cors(corsOptions), passport.authenticate("oidc"))

app.use("/authorize-code/callback", cors(corsOptions), passport.authenticate("oidc", { failureRedirect: "/login/failed" }),
  (req,res) => {
    res.redirect("http:localhost:3000")
  }
);

//UploadFile
app.post("/upload", async(req,res, next) => {
    console.log(req.files);
    if(!req.files) {
        res.status(400).json({
            message:"No files were uploaded"
        })
    } else {
        const fileSize = req.files.file.size;
        const fileName = req.files.file.name;
        const fileType = req.files.file.mimetype.split("/")[1];
        if(validateFileSize(fileSize, fileType)) {
            req.files.file.mv(`${fileName}`);
            res.status(200).json({
                message: "Files Uploaded Successfully"
            })
        } else {
            res.status(413).json({
                message: "File size is too long"
            })
        }
    }
    (req, res, next);
})

const port = process.env.PORT || 3001;
app.listen(port, () => console.log("App listening on port " + port))