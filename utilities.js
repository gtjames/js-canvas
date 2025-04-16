const readline = require('readline');
const fs       = require('fs');
const axios    = require('axios');

let color = {"3252":  "\x1B[30m", "4205":   "\x1B[30m", "reset":  "\x1B[0m",
    "black": "\x1B[30m", "red":    "\x1B[31m", "green":  "\x1B[32m", "yellow": "\x1B[33m", 
    "blue":  "\x1B[34m", "purple": "\x1B[35m", "cyan":   "\x1B[36m", "white":  "\x1B[37m" }

let canvasURL   = "";
let school      = "";
let courseId    = "";
let API_KEY;

const schoolData = JSON.parse(fs.readFileSync('keys.json', 'utf8'));

// Load API key from 'keys.json'
try {
    const text = fs.readFileSync('keys.json', 'utf8').trim();
    API_KEY = JSON.parse(text)['byupw'];
} catch (error) {
    console.error("Error reading API key file:", error.message);
    process.exit(1);
}

// Set up headers with authorization
let headers = {headers: { 'Authorization': `Bearer ${API_KEY}`}};

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function setColor(rgb) {
    color[courseId] = `\x1B[3${rgb}m`;
    print(`${color[courseId]}Course color for ${courseId}\x1B[0m`)
}

async function setParams() {
    if(process.argv.length > 2)
        courseId = process.argv[2];
    else {
        school   = await askQuestion("Enter School: ");
        courseId = await askQuestion("Enter Course: ");
    }
    school   = school   || "byupw";
    courseId = courseId || "7113";

    setURL(school);
    return courseId
}

function getCourseId() {
    return courseId;
}

function getHeaders() {
    return headers;
}

function getURL() {
    return canvasURL;
}

function setURL(schoolId) {
    canvasURL = `https://${schoolId}.instructure.com/api/v1`;
    headers   = {headers: { Authorization: `Bearer ${schoolData[schoolId]}` }};
}

function sortByAttr(data, attribute) {
    let descending = attribute.startsWith("-");
    attribute = descending ? attribute.substring(1) : attribute;

    try {
        return [attribute, [...data].sort((a, b) => {
            let aValue = ("" + a[attribute]).toUpperCase();
            let bValue = ("" + b[attribute]).toUpperCase();

            let comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;

            return descending ? -comparison : comparison;
        })];
    } catch (error) {
        console.error(`Invalid attribute: ${attribute}`);
        return data;
    }
}
async function sendMessage(courseId, studentId, subject, body) {
    // const payload = {
    //     "recipients[]":  studentId.map(id => id.toString()), // Ensure IDs are strings
    //     "subject":       `WDD 330 - ${subject}`,
    //     "body":          body,
    //     "context_code":  `course_${courseId}`,
    //     "bulk_message":  false
    // };

    // Encode the parameters for a URL query string
    const params = new URLSearchParams();
    studentId.forEach(id => params.append("recipients[]", id)); // Canvas API expects recipients[] as an array
    params.append("subject", `WDD 330 - ${subject}`);
    params.append("body", body);
    params.append("context_code", `course_${courseId}`);
    params.append("bulk_message", "true");

    try {
        // Make the request with URL parameters instead of a JSON body
        await axios.post(`${canvasURL}/conversations?${params.toString()}`, {}, headers);
    } catch (error) {
        console.error("Error sending message:", error.response?.data || error.message);
    }
}

async function askQuestion(query) {
    return new Promise(resolve => {
        rl.question(query, (answer) => {
            resolve(answer);
        });
    });
}

async function getCanvasData(endpoint, params={}, file=undefined) {
    try {
        if (file && fs.existsSync("./cache/"+file+".json")) {
            return readJSON(file);
        }
        // console.log(`API ${canvasURL}${endpoint}`);

        const response = await fetch(`${canvasURL}${endpoint}`, headers, params);
        const jsonData = await response.json();
        if (file) {
            writeJSON(file, jsonData);
        }
        return jsonData;
 
        // const response = await axios.get(`${canvasURL}${endpoint}`, headers, params);
        // if (file) {
        //     writeJSON(file, response.jsonData);
        // }
        // return response.jsonData;
    } catch (error) {
        console.error("Error fetching data:", error.response?.data || error.message);
        console.error("Stack Trace:", error.stack);
        return null;
    }
}

async function putCanvasData(endpoint, params={}) {
    try {
        // console.log(`${canvasURL}${endpoint}`);
        const response = await axios.put(`${canvasURL}${endpoint}`, params, headers);
        return response.data;
    } catch (error) {
        console.error("Error putting data:", error.response?.data || error.message);
        return null;
    }
}

function writeJSON(file, data) {
    // Write JSON data to file
    fs.writeFileSync("./cache/"+file+".json", JSON.stringify(data, null, 4));
    // console.log(`Done writing ${file}`)
}

function readJSON(file) {
    // Read JSON data from file and parse it back
    const rawData = fs.readFileSync("./cache/"+file+".json");
    const data = JSON.parse(rawData);
    // console.log(`Done reading ${file}`)
    return data;
}

module.exports = { askQuestion, getCanvasData, putCanvasData, sendMessage, sortByAttr, 
                getCourseId, setColor, setParams, getURL, setURL, getHeaders,
                writeJSON, readJSON};
