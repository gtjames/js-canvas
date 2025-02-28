const axios = require('axios');
const c = require('./canvas');
const u = require('./utilities');

async function renameGroups() {
    const times = [
        " 1 PM UTC --  6 AM Mtn", " 3 PM UTC --  8 AM Mtn", " 5 PM UTC -- 10 AM Mtn",
        " 7 PM UTC --  Noon Mtn", " 9 PM UTC --  2 PM Mtn", "11 PM UTC --  4 PM Mtn",
        " 1 AM UTC --  6 PM Mtn", " 3 AM UTC --  8 PM Mtn"
    ];
    
    const courses = await c.getCategories(c.courseId);
    
    for (const course of courses) {
        console.log(course.name);
        const groups = await c.getGroups(course.id);
        
        let grpNum = 0;
        let teamNum = 0;
        let first = true;
        
        for (const group of groups) {
            console.log(group.name);
            
            let teamName;
            if (first) {
                teamName = "People Dropping the Class";
                first = false;
            } else {
                const day = grpNum < 8 ? "Tuesday" : "Thursday";
                teamName = `Team ${teamNum.toString().padStart(2, '0')} WDD330 ${day} ${times[grpNum % 8]}`;
            }
            console.log(teamName);
            
            const data = { name: teamName, max_membership: 6 }; 
            await axios.put(`${u.canvasURL}/groups/${group.id}`, data, { headers: c.headers });
            
            grpNum++;
            teamNum++;
            if (teamNum === 8) 
                teamNum += 2;
        }
    }
}

module.exports = { renameGroups };
