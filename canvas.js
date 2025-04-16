const { askQuestion, getCanvasData, sendMessage, sortByAttr, getCourseId } = require('./utilities');
const { x, rowColor} = require('./colors');

const cache = {
    announcements:       {},
    assignments:         {},
    categories:          {},
    enrollments:         {},
    groupMembers:        {},
    groups:              {},
    lastLogin:           {},
    scores:              {},
    studentsById:        {},
    studentList:         {},
    allSubmissions:      {},
    submissionsByStudent:{},
    unassigned:          {},
};

async function listTeamMembersByGroup(courseId) {

//  show members in all groups, groups of one or not affiliated with a group
    let [categories, groups]  = await getStudentGroups(courseId);
    let grpType    = await askQuestion("(1) Solo, (0) All, (u) Unassigned: ");
    
    while (grpType.length > 0) {
        let cnt = 0;
        
        for (const category of categories) {
            if (category.name === "Who is Here") continue;
            
            console.log(`${category.name}`);
            
            if (grpType === "u") {
                let members = await getUnassigned(category.id);
                for (const member of members) {
                    showStudent(courseId, member.id, member.name);
                }
                console.log(`${members.length} - unassigned`);
                
                if (await askQuestion("Email the Unassigned?: ") === 'y') {
                    let studentIds = members.map(student => student.id);
                    await sendMessage(studentIds, "You have not yet found a team", "Please identify a team that works for your schedule and add your name to the group");
                }
            } else {
                // let groups = await getGroups(category.id);
                for (const group of groups) {
                    if (group.members_count === 0) {
                        continue;
                    }
                    if ((group.members_count === 1 && grpType === "1") || grpType === "0") {
                        cnt += await listMembers(courseId, group, grpType);
                    }
                }
                console.log(`Members: ${cnt}`);
            }
        }
        grpType = await askQuestion("(1) Solo, (0) All, (u) Unassigned: ");
    }
}

//  show all details about the students
async function studentSearch(courseId) {
    let students = [];
    let studentList = await getStudentList(courseId)
    
    let notifyNoneParticipating = false
    if (await askQuestion("Email Non Participating?: ") == 'y')
        notifyNoneParticipating = true

    let group = "";
    let sortBy = await askQuestion("Sort By (first, last, group, score, login, tz, email, id, search): ");
    let size = 0;
    while (sortBy.length > 0) {
        if (sortBy === "search") {
            let name = await askQuestion("Enter First or Last Name: ");
            students = studentList.filter(s=>s.name.indexOf(name) >= 0);
        } else {
            [sortBy, students] = sortByAttr(studentList, sortBy);
        }
        console.log(`# of Students: ${students.length}`);
        for (const student of students) {
            switch (sortBy) {
                case    "search"    :
                    let allAssignments = await getAllAssignments(courseId, student.id);
                    let missed         = allAssignments.submissions.filter(a =>   a.missed);
                    let submitted      = allAssignments.submissions.filter(a => ! a.missed);
                    console.log(`${x.reset}${student.first} ${student.last}\nEmail:\t\t${student.email}\nGroup:\t\t${student.group}\nTime Zone:\t${student.tz}\nLast Login:\t${student.login}\nID:\t\t${student.id}\nScore:\t\t${student["score"]}\nGrade:\t\t${student.grade}\nTime Active:\t${student.activityTime}`);
                    console.log(`${missed.map(   a => `${x.fgBlue}  ${a.title}\t${x.fgRed}Missing`).join("\n") || "\tNone Missing"}`);
                    console.log(`${submitted.map(a => `${rowColor()}  ${a.title}${a.grade}/${a.possiblePts}  ${a.submittedAt}${x.reset}`).join("\n") || ""}`);
                    break
                case    "group"     :
                    if (group !== student.group) {
                        if (size > 0)                        //  if so, print the group size
                            console.log(`Members in Group ${size}`)
                        console.log(`\t\t${student.group}`);
                        group = student.group;
                        size = 0;
                    }
                    size++;
                    console.log(`${rowColor()}${student.first} ${student.last} : ${student.login} : ${student.emai} : ${student.tz}`)
                    break;
                case    "login"         :
                case    "lastActivity"  :
                    console.log(`${rowColor()}${student.first} ${student.last} : ${student.login} : ${student.group} : ${student.lastActivity}`);
            
                    let lastLogin = new Date(student.lastLogin);
                    let aWeekAgo = new Date();
                    aWeekAgo.setDate(aWeekAgo.getDate() - 7);
            
                    if (lastLogin < aWeekAgo && notifyNoneParticipating) {
                        sendMessage(courseId, [student.id],
                            "You have not participated in the class this week",
                            "Please let me know if you are having trouble with the class"
                        );
                    }
                    break;
                case    "id"        :
                    console.log(`${rowColor()}${student.first} ${student.last} : ${student.email} : ${student.login} : ${student.id}${x.reset}`);
                    break;
                case    "score"         :
                case    "activityTime"  : 
                case    "grade"         :
                    console.log(`${rowColor()}${student["first"]} ${student["last"]} : ${student["score"]} : ${student["grade"]} : ${student["activityTime"]}${x.reset}`);
                    break;
                case    "first"     :
                case    "tz"        :
                    console.log(`${rowColor()}${student.first} ${student.last} : ${x.fgGreen}${student.group}${rowColor(-1)} : ${student.email} : ${student.tz.padEnd(20)}${x.reset}`);
                    break;
                default :
                    console.log(`${rowColor()}${student.first} ${student.last} : ${student.email} : ${student.id}${x.reset}`);
                    break;
            }
        }
        sortBy = await askQuestion(`${x.reset}Sort By (first, last, group, score, login, tz, email, id, search): `);
    }
}

async function getAllStudentDetails(courseId) {
    if (!cache.studentsById[courseId]) {
        //  Get the students in the course
        cache.studentList[courseId] = await getCanvasData(`/courses/${courseId}/users?enrollment_type[]=student&per_page=100`, {}, "students");
        cache.studentsById[courseId] = {}

        //  Get the scores for all assignments for all students
        //  The object returned is a dictionary of students with the following information
        //  { studentId: { lastActivity: "2021-09-01 12:00", activityTime: 1234, grade: "A", score: 90.0 } }
        scores = await getCourseActivity(courseId);

        //  Loop through the students and get all details
        for (const student of cache.studentList[courseId]) {
            //  Profile information of interest is just the time zone
            const profile   = await getStudentProfile(student.id);
            //  Last login is the last time the student logged into the course
            const lastLogin = await getLastLogin(student.id) || "2025-01-01T01:00:00-06:00";
        
            const   [lastName, rest] = student.sortable_name.split(", ");
            const   firstName = rest.split(" ")[0].padEnd(10).slice(0, 10);
            const tm = scores[student.id]?.activityTime ?? -1;       // ATTN:
            
            const   hrs = Math.floor(tm / 60).toString().padStart(4, " ");
            const   min = (tm % 60).toString().padStart(2, "0");

            student.activityTime = `${hrs}.${min}`;
            student.email        = student.email.padEnd(30);
            student.first        = firstName.padEnd(10).slice(0, 10);
            student.grade        = scores[student.id]?.grade || "_";
            student.group        = "Team XX";       //  we will get this later
            student.last         = lastName.padEnd(15).slice(0, 15);
            student.lastActivity = scores[student.id]?.lastActivity.replace('T', ' ').substring(5, 11),
            student.lastLogin    = lastLogin;
            student.login        = lastLogin.replace('T', ' ').slice(5, 11);
            student.name         = student.sortable_name;
            student.score        = scores[student.id]?.score || "0";
            student.tz           = profile.time_zone;
            delete student.created_at;
            delete student.integration_id;
            cache.studentsById[courseId][student.id] = student;
        }
    }
    return cache.studentsById[courseId];
}

//  show all assignments for the students
//      missing and submitted
//      if submitted show the grade
async function listAssignments(courseId) {
    const submissionsByStudent = await getAllSubmissions(courseId);

    const notify = await askQuestion("Notify?: ");
    let msg = await askQuestion("Message?: ");
    msg = msg || "\tThe Following assignments have not been submitted.\n\tThese can all be submitted up to the end of this week (Week 4)";
    const missing = await askQuestion("(A)ll / (M)issing?: ");

    for (const [studentId, unsub] of Object.entries(submissionsByStudent)) {
        console.log(`${x.fgWhite}${x.bright}${x.bgBlack}${unsub.name.padEnd(50)} : ${cache.studentsById[courseId][studentId].email}${x.reset}`);
        let displayList = unsub.submissions;
        [_ ,displayList] = sortByAttr(displayList, "title");
        if (missing === "m") {
            let missingWork = displayList.filter(asgn => asgn.missed);
            missingList = missingWork.map(a => `\t${a.title}`).join("\n") || "\tAll Assignments are Submitted";
            console.log(x.fgRed+missingList+x.reset);
            if (notify === "y" && missingWork.length > 0) {
                await sendMessage(courseId, [`'${studentId}'`], "Missing Assignments", `${msg}\n\n\t${missingWork}`);
            }
        } else {
            for (const assignment of displayList) {
                if (assignment.missed)
                    console.log(` ${x.fgRed} Missing      ${x.fgBlue}${assignment.title}${x.reset}`); 
                else
                    console.log(` ${assignment.score}/${assignment.possiblePts}  ${assignment.submittedAt} ${x.fgBlue}${assignment.title}${x.reset}`); 
            }
        }
    }
}

//  get all groups and the members in the groups
async function getStudentGroups(courseId) {
    let categories  = await getCategories(courseId);
    let studentList = await getStudentList(courseId);
    let groups;

    for (const category of categories) {
        if (category.name === "Who is Here") continue;
        
        groups = await getGroups(category.id);
        for (const group of groups) {
            if (group.members_count === 0) continue;
            
            let members = await getGroupMembers(group.id);
            for (const member of members) {
                student = studentList.find(s => s.id === member.id) || null;
                if (student)
                    student.group = group.name.slice(0, 7);
            }
        }
    }
    return [categories, groups];
}

// Get unassigned students in a group category
async function  getUnassigned(catId) {
    if (!cache.unassigned[catId]) {
        cache.unassigned[catId] = await getCanvasData(`/group_categories/${catId}/users?unassigned=true&per_page=100`, {}, "unassigned");
    }
    return cache.unassigned[catId];
}

//  Get Assignments for the course
//  What is returned
//  cache.assignments[courseId] = [ { id: 425, dueAt: "2021-09-01T12:00:00-06:00", lockAt: "2021-09-01T12:00:00-06:00", possiblePts: 100, title: "Assignment 1", hasSubmissions: true } ]
async function getAssignments(courseId) {
    if (!cache.assignments[courseId]) {
        let tmp = await getCanvasData(`/courses/${courseId}/assignments?per_page=50`, {"per_page": 50}, "assignments");
        let sub = tmp.map(a => { return {
            "id"             : a.id,
            "dueAt"          : a.due_at,
            "lockAt"         : a.lock_at,
            "possiblePts"    : a.points_possible.toFixed(0).padStart(3, " "),
            "title"          : a.name.padEnd(60),
            "hasSubmissions" : a.has_submitted_submissions
            }; 
        });
        cache.assignments[courseId] = sub;
    }
    return cache.assignments[courseId];
}

function getStudentList(courseId) {
    return cache.studentList[courseId];
}

async function getStudentProfile(studentId) {
    return await getCanvasData(`/users/${studentId}/profile`, {}, "st-"+studentId)
}

// Fetch student profile information
function showStudent(courseId, studentId, name) {
    let student = cache.studentList[courseId].find(student => student.id === studentId) || null;
    if (student) {
        console.log(`\t- ${student.first} ${student.last} ${student.email} ${student.tz}`);
    } else {
        console.log(`\t- ${name} has dropped the class`);
    }
}

//  Get the overal grade and activity time for each student
//      what is returned?
//      cache.scores[courseId] = { studentId: { lastActivity: "2021-09-01 12:00", activityTime: 1234, grade: "A", score: 90.0 } }
async function getCourseActivity(courseId) {
    if (!cache.scores[courseId]) {
        cache.enrollments[courseId] = await getCanvasData(`/courses/${courseId}/enrollments?per_page=100&type[]=StudentEnrollment`,{"per_page": 100, "type[]": "StudentEnrollment"}, "activity"); // ATTN:

        cache.scores[courseId] = cache.enrollments[courseId].reduce((acc, student) => {
            acc[student.user_id] = {
                "lastActivity": student['last_activity_at'].replace('T', ' ').substring(5, 11),
                "activityTime": student['total_activity_time'],
                "grade"       : student['grades']['current_grade'].padEnd(2, " "),
                "score"       : student['grades']['current_score'].toFixed(0).padStart(3, " "),
            }; // Use id as the key
            return acc;
        }, {});
    }
    return cache.scores[courseId];
}

// List members in a group
async function listMembers(courseId, group, grpType) {
    console.log(`${group['name']} # in Group: ${group['members_count']}`);
    const members = await getGroupMembers(group.id);
    studentIds = members.map(member => member.id);
    if (members) {
        for (const member of members) {
            showStudent(courseId, member.id, member.name);
        }
    }
    if (members.length === 1 && grpType === "1") {
        if (await askQuestion("Email Lonely People? (y/n): ") === "y") {
            await sendMessage(courseId, studentIds,
                "You are currently the only member of the team",
                "Please identify a team that has others enrolled already that works for your schedule and add your name to the group"
            );
        }
    }

    if (grpType === "0" && await askQuestion("Email Class? (y/n): ") === "y") {
        const subject = await askQuestion("Subject: ");
        const body = await askQuestion("What do you want to say?: ");
        await sendMessage(courseId, studentIds, subject, body);
    }

    return members.length;
}

// Get group categories
async function getCategories(courseId) {
    if (!cache.categories[courseId]) {
        cache.categories[courseId] = await getCanvasData(`/courses/${courseId}/group_categories`, {}, "categories");
    }
    return cache.categories[courseId];
}

// Get all groups within the specified group category
async function getGroups(catId) {
    if (!cache.groups[catId]) {
        cache.groups[catId] = await getCanvasData(`/group_categories/${catId}/groups`, {"per_page": 30}, "grps-"+catId);
    }
    return cache.groups[catId];
}

// Step 2: Get all groups within the specified group category
async function getGroupMembers(groupId) {
    if (!cache.groupMembers[groupId]) {
        cache.groupMembers[groupId] = await getCanvasData(`/groups/${groupId}/users`, {"per_page": 70}, "grpMbrs-"+groupId);
    }
    return cache.groupMembers[groupId];
}

//  Get Last Login
async function getLastLogin(studentId) {
    if (!cache.lastLogin[studentId]) {
        cache.lastLogin[studentId] = await getCanvasData(`/users/${studentId}`, {"include[]": "last_login"}, "ll-"+studentId);
    }
    return cache.lastLogin[studentId]['last_login'];
}

async function getAllSubmissions(courseId) {
    if (!cache.submissionsByStudent[courseId]) {

        const students    = await getStudentList(courseId);   //  student details
        const assignments = await getAssignments(courseId);     //  assignment details
    
        let submissionsByStudent = {};
        let allSubmissions = {};
        
        // Initialize student assignments object
        students.forEach(student => {
            submissionsByStudent[student.id] = { name: student.name, submissions: [] };
        });
    
        today = new Date();
        // assignments = assignments.filter(a => new Date(a.dueAt) < today);

        for (const assignment of assignments) {    
            // Fetch all submissions for the assignment
            allSubmissions[assignment.id] = await getSubmissions(courseId, assignment);

            for (const submission of allSubmissions[assignment.id]) {
                const studentId = submission.userId;
                if (studentId in submissionsByStudent) {
                    submissionsByStudent[studentId].submissions.push(submission);
                }
            }
        }
        cache.submissionsByStudent[courseId] = submissionsByStudent;
    }
    return cache.submissionsByStudent[courseId];
}

async function getAllAssignments(courseId, studentId) {
    if (!cache.submissionsByStudent[courseId])
        await getAllSubmissions(courseId);
    return cache.submissionsByStudent[courseId][studentId];
}

//  Get Submissions by Status
//  
//  What is returned?
//  cache.allSubmissions[assignmentId] = [ { userId: 123, grade: 90, score: 90, submittedAt: "2021-09-01T12:00:00-06:00", workflowState: "submitted", missing: false } ]
async function getSubmissions(courseId, assignment) {
    if (!cache.allSubmissions[assignment.id]) {
        tmp = await getCanvasData(`/courses/${courseId}/assignments/${assignment.id}/submissions?per_page=50`, {}, "sub"+assignment.id);
        let sub;
        try {
            sub = tmp.map(a => { return {
                "assignmentId"  : a.assignment_id,
                "grade"         : (a.grade ?? " ").toString().padStart(2),
                "gradedAt"      : a.graded_at,
                "id"            : a.id,
                "late"          : a.late,
                "missed"        : a.missing,
                "missing"       : a.missing ? "missing" : "done   ",
                "score"         : (a.score ??   0).toFixed(0).padStart(3, " "),
                "secondsLate"   : a.seconds_late,
                "submittedAt"   : (a.submitted_at ?? "              " ).substring(6,10),
                "userId"        : a.user_id,
                "workflowState" : a.workflow_state,
                "dueAt"         : assignment.dueAt,
                "possiblePts"   : assignment.possiblePts,
                "title"         : assignment.title,
            }; 
        });
        } catch (e) {
            console.log(e);
        }
        cache.allSubmissions[assignment.id] = sub;
    }
    return cache.allSubmissions[assignment.id];
}

async function sendStatusLetters(courseId) {
    let list             = await getStudentList(courseId)
    let pastAssisgnments = await getAllSubmissions(courseId)

    const [x, studentList]      = sortByAttr(list, "score");

    await statusLetter(courseId, studentList, 90, 101, pastAssisgnments,
        "Keep up the good work!: Current Score: ",
        "\nYou are doing very well in the class keep up the good work");
    await statusLetter(courseId, studentList, 70, 90, pastAssisgnments,
        "You are doing well but might be missing a few assignments: Current Score: ",
        "\nYou can still turn these in until the end of week four");
    await statusLetter(courseId, studentList, 0, 70, pastAssisgnments,
        "How are you doing in the class? It looks like you are struggling: Current Score: ",
        "\nHere is a list of your missing assignments. You can still turn these in until the end of week four\nDon't forget there is tutoring available for the class.");
}

async function statusLetter(courseId, studentScores, lo, hi, unfinishedAssignments, subject, body) {
    let studentList = studentScores.filter(student => lo < student.score && student.score < hi);

    let go         = await askQuestion("go/no go? ") == "go";
    let showMissed = await askQuestion("Show Missed? ") == "y" ? true : false;

    for( let s of studentList) {
        let missed = unfinishedAssignments[s.id].submissions.filter(a => a.missed).map(a => `\t${a.title}`).join("\n") || "";
        console.log(`${s.score} - ${s.first} ${s.last}`);

        today = new Date();
        let pastAssisgnments = unfinishedAssignments[s.id].submissions.filter(a => new Date(a.dueAt) < today && a.missed);
       
        if (missed.length == 0)     continue;
        if (showMissed)             console.log(x.fgRed+missed+x.reset);
        if (go)                     continue;

        await sendMessage(courseId, 
            [s.id],
            `${subject} ${s.score}`,
            `\n${s.firstName},\n${body}\nMissing Assignments (if any)\n${missed}\n\nBro. James`
        );
    };
}

async function getAnnouncements(courseId) {
    if (!cache.announcements[courseId]) {
        cache.announcements[courseId] = await getCanvasData(`/courses/${courseId}/discussion_topics?only_announcements=true`, {}, "announcements");
    }
    return cache.announcements[courseId];
}

async function listAnnouncements(courseId) {
    announcements = await getAnnouncements(courseId);
    for (const announcement of announcements) {
        console.log(`${announcement['id']}  ${announcement['title']}`);
    }
}
function clearCache() {
    Object.keys(cache).forEach(key => cache[key] = {});
}

async function startUp(courseId) {
    await getAllStudentDetails (courseId)       //  _students
    await getStudentGroups (courseId)       //  _categories
}

// Export the function
module.exports =  { clearCache, listAnnouncements, startUp, getAllStudentDetails, listTeamMembersByGroup, 
    studentSearch, getGroups, sendStatusLetters, listAssignments, getCategories };
