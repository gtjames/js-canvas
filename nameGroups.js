const axios = require('axios');
const c = require('./canvas');
const {getCourseId, getURL, getHeaders, putCanvasData} = require('./utilities');

async function renameGroups() {
    const times = [
        " 1 PM UTC --  6 AM Mtn",    " 3 PM UTC --  8 AM Mtn",      " 5 PM UTC -- 10 AM Mtn",
        " 7 PM UTC --  Noon Mtn",    " 9 PM UTC --  2 PM Mtn",      "11 PM UTC --  4 PM Mtn",
        " 1 AM UTC --  6 PM Mtn",    " 3 AM UTC --  8 PM Mtn"
    ];
    
    const categories = await c.getCategories(getCourseId());
    
    for (const category of categories) {
        console.log(category.name);
        if (category.name === "Who is Here") {
            continue;
        }

        const groups = await c.getGroups(category.id);
        
        let grpNum = 0;
        let teamNum = 0;
        let first = true;
        
        for (const group of groups) {
            console.log(group.name);
            
            let teamName;
            if (first) {
                teamName = "ZZ Tops- People Dropping the Class";
            } else {
                const day = grpNum < 8 ? "Tuesday" : "Thursday";
                teamName = `Team ${teamNum.toString().padStart(2, '0')} WDD330 ${day} ${times[grpNum % 8]}`;
            }
            console.log(teamName);
            
            const data = { name: teamName, max_membership: 7 }; 
            await putCanvasData(`/groups/${group.id}`, data);
            if (first) {
                first = false;
                continue;
            }
            grpNum++;
            teamNum++;
            if (teamNum === 8) 
                teamNum += 2;
        }
    }
}

module.exports = { renameGroups };
