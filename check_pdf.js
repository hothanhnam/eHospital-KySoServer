const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('test.pdf');

pdf(dataBuffer).then(function(data) {
    console.log("NUM PAGES: " + data.numpages);
}).catch(function(error){
    console.log("Error: " + error);
});
