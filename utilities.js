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

const data = JSON.parse(fs.readFileSync('keys.json', 'utf8'));

// Load API key from 'keys.json'
try {
    const text = fs.readFileSync('keys.json', 'utf8').trim();
    API_KEY = JSON.parse(text)['byupw'];
} catch (error) {
    console.error("Error reading API key file:", error.message);
    process.exit(1);
}

// Set up headers with authorization
let headers = { 'Authorization': `Bearer ${API_KEY}`};

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function setColor(rgb) {
    color[courseId] = `\x1B[3${rgb}m`;
    print(`${color[courseId]}Course color for ${courseId}\x1B[0m`)
}

async function setParams() {
    school = await askQuestion("Enter School: ");
    courseId = await askQuestion("Enter Course: ");
    setSchool(school);
    return courseId
}

function getCourseId() {
    return courseId;
}

function setSchool(schoolId) {
    school = schoolId || "byupw";
    canvasURL = `https://${school}.instructure.com/api/v1`;
    headers   = { Authorization: `Bearer ${data[school]}` };
}

function sortByAttr(data, attribute) {
    try {
        return data.sort((a, b) => {
            if (a[attribute] < b[attribute]) return -1;
            if (a[attribute] > b[attribute]) return 1;
            return 0;
        });
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

    const choice = await askQuestion("go?");
    if (choice !== "y") {
        return;
    }

    // Encode the parameters for a URL query string
    const params = new URLSearchParams();
    studentId.forEach(id => params.append("recipients[]", id)); // Canvas API expects recipients[] as an array
    params.append("subject", `WDD 330 - ${subject}`);
    params.append("body", body);
    params.append("context_code", `course_${courseId}`);
    params.append("bulk_message", "true");

    console.log("Sending message with params:", params.toString());

    try {
        // Make the request with URL parameters instead of a JSON body
        await axios.post(`${canvasURL}/conversations?${params.toString()}`, {}, { headers });
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

async function getCanvasData(endpoint, params={}) {
    try {
        const response = await axios.get(`${canvasURL}${endpoint}`, { headers }, {params});
        return response.data;
    } catch (error) {
        console.error("Error fetching data:", error.response?.data || error.message);
        return null;
    }
}

module.exports = { askQuestion, getCanvasData, sendMessage, sortByAttr, 
                getCourseId, setColor, setParams, setSchool }