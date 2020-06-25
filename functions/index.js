const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const express = require('express')
const bodyParser = require('body-parser')
const path = require('path')
require('dotenv').config();
const app = express()
var cors = require('cors');
app.use(bodyParser.urlencoded({ extended: false }))
app.use(cors({ origin: '*' }));

exports.index = functions.https.onRequest((req, res) => {
    res.sendFile(path.resolve(process.cwd(), 'public', 'index.html'))
})

var aws = require('aws-sdk');
aws.config.update({ // configure your AWS access
    accessKeyId: process.env.AWS_ACESS_KEY_ID, // remember to use environment variables - store you credentials in a .env file and use .gitignore!
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    signatureVersion: 'v4', // important to include this
    region: process.env.AWS_REGION
});
var s3 = new aws.S3();

exports.uploader = functions.https.onRequest((req, res) => {
    var metaName = ""; // we're going to use the user input file name as metadata, and if the user hasn't input anything, we'll use the original file name. Here we prepare the variable
    if (JSON.parse(Object.keys(req.body)[0]).metadata.name === "") { // here we test if the user has input anything in the 'name' field - this is the convoluted way we need to extract the name from the passed stringified JSON object - if there's a better way to do this, I'm all ears...
        metaName = JSON.parse(Object.keys(req.body)[0]).filename; // if the user hasn't made any changes, just use the original filename
    } else {
        metaName = JSON.parse(Object.keys(req.body)[0]).metadata.name; // otherwise, use whatever the user has input (this should probably be sanitized...)
    }
    var metaCaption = ""; // set up a variable to capture whatever the user input in the 'caption' field
    if (!JSON.parse(Object.keys(req.body)[0]).metadata.caption) { // if there is no caption...
        metaCaption = ""; // set it blank
    } else {
        metaCaption = JSON.parse(Object.keys(req.body)[0]).metadata.caption; // otherwise, use what the user input
    }
    let tag1 = 'fileName=' + metaName; // build our first tag - AWS tags look like 'key=value' so we'll use 'fileName' as a key and then take our metaName variable from above
    let tag2 = ""; // set up our second tag for the user input caption - we'll only add this tag if the user has input something
    if (metaCaption) { // if the caption exists...
        tag2 = 'fileDescription=' + metaCaption; // add it to the 'fileDescription' key
    } else {
        tag2 = ''; // otherwise, it's blank
    }
    const tags = tag1 + "&" + tag2; // we need to concatenate the tags, joining them with an ampersand so they'll look the way our AWS S3 bucket expects: 'key1=value1&key2=value2' etc.
    const combinedTags = String(tags); // now let's turn our combined tags into a string
    const params = { // now let's set up our parameters for the pre-signed key...
        Metadata: { // here we're adding metadata. The key difference between metadata and tags is that tags can be changed - metadata cannot!
            'fileName': metaName, // add the user-input filename as the value for the 'fileName' metadata key
            'caption': metaCaption, // add the user-input caption as the value for the 'caption' metadata key
            'user': 'test', // let's grab the user who uploaded this and use the username as the value with the 'user' key
            'uploadDateUTC': Date(), // and let's grab the UTC date the file was uploaded
        },
        Bucket: process.env.AWS_S3_BUCKET, // our AWS S3 upload bucket, from way above...
        Key: `Account_Uploads/${Date.now().toString()}-${JSON.parse(Object.keys(req.body)[0]).filename}`,      // what we'll call our file - here I'm using a folder called "Account_Uploads" to put all my uploads into, then prepending a date string to the filename to avoid collisions - S3 will overwrite a file if another with the same key (i.e. name) is uploaded! We have to again extract the filename in a tedious fashion...
        ContentType: JSON.parse(Object.keys(req.body)[0]).contentType, // get the content type
        Tagging: "random=random", //inexplicably, if we don't put this in, tagging fails. Any tags will do here - I literally use 'random=random' - something just needs to be here...this is the voodoo section of our program...   
    };
    console.log(params)
    s3.getSignedUrl('putObject', params, (err, url) => { // get the pre-signed URL from AWS - if you alter this URL, it will fail          
        console.log(err)
        console.log(url)
        res.status(200).json({ // send info back to the client/front end
            method: 'put', // our upload method
            url, // variable to hold the URL
            fields: {}, // leave this an empty object
            headers: { 'x-amz-tagging': combinedTags } // here we add the tags we created above
        });
    });
});
exports.test = functions.https.onRequest((req, res) => {
    return res.status(200).json({
        message: "Hello world"
    });
});
