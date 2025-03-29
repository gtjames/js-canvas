const { askQuestion, getCanvasData, sendMessage, sortByAttr } = require('./utilities');

const cache = {
    allSubmissions:      {},
    announcements:       {},
    assignments:         {},
    categories:          {},
    enrollments:         {},
    groupMembers:        {},
    groups:              {},
    lastLogin:           {},
    scores:              {},
    students:            {},
    studentsByIds :      {},
    submissionByStatus:  {},
    submissionsByStudent:{},
    allSubmissions:      {},
    unassigned:          {},
};

function clearCache() {
    Object.keys(cache).forEach(key => cache[key] = {});
}

async function startUp(courseId) {
    await getStudents (courseId)       //  _students
    await buildGroups      (courseId)       //  _categories
    // getGroups        (1706)           
    //    _groups
    // getUnassigned   (1706)               _unassigned
    // getGroupMembers(groupId)             _groupMembers  = {}
    // getLastLogin(studentId)              _lastLogin     = {}
    // getSubmissions(courseId, 425, 'unsubmitted')      _submissionByStatus
    // getUnfinishedAssignments(courseId)    
    // getAnnouncements(courseId)           _announcements
    // getAssignments  (courseId)           _assignments
}

async function getAnnouncements(courseId) {
    if (!cache.announcements[courseId]) {
        cache.announcements[courseId] = await getCanvasData(`/courses/${courseId}/discussion_topics?only_announcements=true`);
    }
    return cache.announcements[courseId];
}

async function listAnnouncements(courseId) {
    announcements = await getAnnouncements(courseId);
    for (const announcement of announcements) {
        console.log(`${announcement['id']}  ${announcement['title']}`);
    }
}

function getStudentsByIds(courseId) {
    return cache.studentsByIds[courseId];
} 
async function getStudents(courseId) {
    if (!cache.students[courseId]) {
        cache.studentsByIds[courseId] = await getCanvasData(`/courses/${courseId}/users?enrollment_type[]=student&per_page=100`);
        cache.students[courseId] = {}

        scores = await getEnrollments(courseId);

        for (const student of cache.studentsByIds[courseId]) {
            const profile   = await getStudentProfile(student.id);
            const lastLogin = await getLastLogin(student.id) || "2025-01-01T01:00:00-06:00";
        
            const   [lastName, rest] = student.sortable_name.split(", ");
            const   firstName = rest.split(" ")[0].padEnd(10).slice(0, 10);
            const   tm  = scores[student.id]["activityTime"]
            const   hrs = Math.floor(tm / 60).toString().padStart(3, " ");
            const   min = (tm % 60).toString().padStart(2, "0");

            student.group        = "Team XX";
            student.lastActivity = scores[student.id]?.lastActivity.replace('T', ' ').substring(5, 16),
            student.score        = scores[student.id]?.score || "_";
            student.grade        = scores[student.id]?.grade || "_";
            student.lastLogin    = lastLogin;
            student.login        = lastLogin.replace('T', ' ').slice(5, 16);
            student.name         = student.sortable_name;
            student.first        = firstName.padEnd(10).slice(0, 10);
            student.last         = lastName.padEnd(15).slice(0, 15);
            student.email        = student.email.padEnd(30);
            student.activityTime = `${hrs}.${min}`;
            student.tz           = profile.time_zone;
            cache.students[courseId][student.id] =student;

        }
    }
    return cache.students[courseId];
}

async function getStudentProfile(studentId) {
    return getCanvasData(`/users/${studentId}/profile`)
}

async function getStudent(courseId, studentId) {
    let studentRec = cache.studentsByIds[courseId].find(student => student.id === studentId) || null;
    if (studentRec === null) {
        console.log(`    - ${studentId} not found`);
        studentRec = await getStudentProfile(studentId);
        cache.students[courseId].push(studentRec);
    }
    return studentRec;
}

// Fetch student profile information
async function showStudent(courseId, studentId, name) {
    const student = await getStudent(courseId, studentId);
    if (student) {
        console.log(`\t- ${student.first} ${student.last} ${student.email} ${student.tz}`);
    } else {
        console.log(`\t- ${name} has dropped the class`);
    }
}

// Get group categories
async function getCategories(courseId) {
    if (!cache.categories[courseId]) {
        cache.categories[courseId] = await getCanvasData(`/courses/${courseId}/group_categories`);
    }
    return cache.categories[courseId];
}

async function buildGroups(courseId) {
    let categories  = await getCategories(courseId);
    let studentList = await getStudentsByIds(courseId);

    for (const category of categories) {
        if (category.name === "Who is Here") continue;
        
        let groups = await getGroups(category.id);
        for (const group of groups) {
            if (group.members_count === 0) continue;
            
            let members = await getGroupMembers(group.id);
            for (const member of members) {
                student = studentList.find(s => s.id === member.id) || null;
                student.group = group.name.slice(0, 7);
            }
        }
    }
}

// Get unassigned students in a group category
async function getUnassigned(groupId) {
    if (!cache.unassigned[groupId]) {
        cache.unassigned[groupId] = await getCanvasData(`/group_categories/${groupId}/users?unassigned=true&per_page=100`);
    }
    return cache.unassigned[groupId];
}

async function listTeamMembers(courseId) {
    let categories = await getCategories(courseId);
    let grpType    = await askQuestion("(1) Solo, (0) All, (u) Unassigned: ");
    
    while (grpType.length > 0) {
        let cnt = 0;
        
        for (const category of categories) {
            if (category.name === "Who is Here") continue;
            
            console.log(`${category.name}`);
            
            if (grpType === "u") {
                let members = await getUnassigned(category.id);
                for (const member of members) {
                    await showStudent(courseId, member.id, member.name);
                }
                console.log(`${members.length} - unassigned`);
                
                if (await askQuestion("Email the Unassigned?: ") === 'y') {
                    let studentIds = members.map(student => student.id);
                    await sendMessage(studentIds, "You have not yet found a team", "Please identify a team that works for your schedule and add your name to the group");
                }
            } else {
                let groups = await getGroups(category.id);
                for (const group of groups) {
                    if (group.members_count === 0) continue;
                    
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

//  Get the overal grade and activit time for each student
//      what is returned?
//      cache.scores[courseId] = { studentId: { lastActivity: "2021-09-01 12:00", activityTime: 1234, grade: "A", score: 90.0 } }
async function getEnrollments(courseId) {
    if (!cache.scores[courseId]) {
        cache.enrollments[courseId] = await getCanvasData(`/courses/${courseId}/enrollments?per_page=100&type[]=StudentEnrollment`,{"per_page": 100}); // ATTN:

        cache.scores[courseId] = cache.enrollments[courseId].reduce((acc, student) => {
            acc[student.user_id] = {
                "lastActivity": student['last_activity_at'].replace('T', ' ').substring(5, 16),
                "activityTime": student['total_activity_time'],
                "grade"       : student['grades']['current_grade'].padEnd(2, " "),
                "score"       : student['grades']['current_score']    
            }; // Use id as the key
            return acc;
        }, {});
    }
    return cache.scores[courseId];
}

async function studentInTeam(courseId) {
    let students = [];
    studentsInCourse = await getStudentsByIds(courseId)
    
    let notifyNoneParticipating = false
    if (await askQuestion("Email Non Participating?: ") == 'y')
        notifyNoneParticipating = true

    let group = "";
    let sortBy = await askQuestion("Sort By (first, last, group, score, login, tz, email, id): ");
    let size = 0;
    while (sortBy.length > 0) {
        if (sortBy === "search") {
            let name = await askQuestion("Enter First or Last Name: ");
            students = studentsInCourse.filter(s=>s.name.indexOf(name) >= 0);
        } else {
            [sortBy, students] = sortByAttr(studentsInCourse, sortBy);
        }
        for (const student of students) {
            switch (sortBy) {
                case    "search"    :
                    let allAssignments = getAllAssignments(student.id);
                    console.log(`${student.first} ${student.last}\nEmail:\t\t${student.email}\nGroup:\t\t${student.group}\nTime Zone:\t${student.tz}\nLast Login:\t${student.login}\nID:\t\t${student.id}\nScore:\t\t${student["score"]}\tGrade:\t${student.grade}\nTime Active:\t${student.activityTime}`);
                    console.log(`${allAssignments[student.id]?.all.map(a => `\t${a}`).join("\n") || "\tNone"}`);
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
                    console.log(`${student["first"]} ${student["last"]} : ${student["email"]} : ${student["tz"]}`)
                    break;
                case    "login"         :
                case    "lastActivity"  :
                    console.log(`${student.first} ${student.last} : ${student.email} : ${student.login} : ${student.id}`);
            
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
                    console.log(`${student.first} ${student.last} : ${student.email} : ${student.login} : ${student.id}`);
                    break;
                case    "score"         :
                case    "activityTime"  : 
                case    "grade"         :
                    console.log(`${student["first"]} ${student["last"]} : ${student["score"]} : ${student["grade"]} : ${student["activityTime"]}`);
                    break;
                case    "first"     :
                case    "tz"        :
                    console.log(`${student.first} ${student.last} : ${student.email} : ${student.group} : ${student.tz}`);
                    break;
                default :
                    console.log(`${student.first} ${student.last} : ${student.email} : ${student.id}`);
                    break;
            }
        }
        sortBy = await askQuestion("Sort By (first, last, group, score, login, tz, email, id): ");
    }
}

// List members in a group
async function listMembers(courseId, group, grpType) {
    console.log(`${group['name']} # in Group: ${group['members_count']}`);
    const members = await getGroupMembers(group.id);
    studentIds = members.map(member => member.id);
    if (members) {
        for (const member of members) {
            await showStudent(courseId, member.id, member.name);
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

// Get all groups within the specified group category
async function getGroups(catId) {
    if (!cache.groups[catId]) {
        cache.groups[catId] = await getCanvasData(`/group_categories/${catId}/groups?per_page=30`);
    }
    return cache.groups[catId];
}

// Step 2: Get all groups within the specified group category
async function getGroupMembers(groupId) {
    if (!cache.groupMembers[groupId]) {
        cache.groupMembers[groupId] = await getCanvasData(`/groups/${groupId}/users?per_page=70`);
    }
    return cache.groupMembers[groupId];
}

async function sendStatusLetters(courseId) {
    let list             = await getStudentsByIds(courseId)
    let [unfinishedAssignments, all]   = await getUnfinishedAssignments(courseId)
    const [x, studentList]      = sortByAttr(list, "score");

    await statusLetter(courseId, studentList, 90, 100, unfinishedAssignments,
        "Keep up the good work!: Current Score: ",
        "\nYou are doing very well in the class keep up the good work");
    await statusLetter(courseId, studentList, 70, 90, unfinishedAssignments,
        "You are doing well but might be missing a few assignments: Current Score: ",
        "\nYou can still turn these in until the end of week four");
    await statusLetter(courseId, studentList, 0, 70, unfinishedAssignments,
        "How are you doing in the class? It looks like you are struggling: Current Score: ",
        "\nHere is a list of your missing assignments. You can still turn these in until the end of week four\nDon't forget there is tutoring available for the class.");
}

async function statusLetter(courseId, studentScores, lo, hi, unfinishedAssignments, subject, body) {
    let studentList = studentScores.filter(student => lo < student.score && student.score < hi);

    let go = await askQuestion("go/no go? ");

    for( let s of studentList) {
        let missed = unfinishedAssignments[s.id]?.unsubmitted.map(a => `\t${a}`).join("\n") || "\tNone";

        console.log(`${s.name} - ${s.score}\n${missed}`);

        if (go !== "go") 
            continue;

        await sendMessage(courseId, 
            [s.id],
            `${subject} ${s.score}`,
            `\n${s.firstName},\n${body}\nMissing Assignments (if any)\n${missed}\n\nBro. James`
        );
    };
}
async function listUnsubmitted(courseId) {
    const [submissionsByStudent, allSubmissions] = await getUnfinishedAssignments(courseId);
    const studentIds = new Set();

    const notify = await askQuestion("Notify?: ");
    let msg = await askQuestion("Message?: ");
    msg = msg || "\tThe Following assignments have not been submitted.\n\tThese can all be submitted up to the end of this week (Week 4)";

    for (const [studentId, info] of Object.entries(submissionsByStudent)) {
        if (info.submissions.length > 0) {
            studentIds.add(studentId);
            console.log(`${info.name.padEnd(50).slice(0, 50)} : ${studentId}`);
            for (const assignment of info.submissions) {
                console.log(`    - ${assignment.title} ${assignment.score} ${assignment.submittedAt}`); 
            }
            if (notify === "y") {
                const missed = info.submissions.join("\n\t");
                await sendMessage(courseId, [`'${studentId}'`], "Missing Assignments", `${msg}\n\n\t${missed}`);
            }
        }
    }
}

//  Get Last Login
async function getLastLogin(studentId) {
    if (!cache.lastLogin[studentId]) {
        cache.lastLogin[studentId] = await getCanvasData(`/users/${studentId}?include[]=last_login`);
    }
    return cache.lastLogin[studentId]['last_login'];
}

async function getUnfinishedAssignments(courseId) {
    if (!cache.allSubmissions[courseId]) {
        const students    = await getStudentsByIds(courseId);   //  student details
        const assignments = await getAssignments(courseId);     //  assignment details
    
        let submissionsByStudent = {};
        let allSubmissions = {};
        let assignmentsName = {};
        
        // Initialize student assignments object
        students.forEach(student => {
            submissionsByStudent[student.id] = { name: student.name, submissions: [] };
        });

        assignments.forEach(assignment => {
            assignmentsName[assignment.id] = { name: assignment.name };
        });

        today = new Date();
        let pastAssisgnments = assignments.filter(a => new Date(a.dueAt) < today);

        for (const assignment of pastAssisgnments) {    
            // Fetch all submissions for the assignment
            allSubmissions[assignment.id] = await getSubmissions(courseId, assignment.id);
            allSubmissions[assignment.id].title = assignment.title;

            // Get all unsubmitted assignments
            // return cache.submissionByStatus[assignmentId].filter(s => s.missing == true);
    
            for (const submission of allSubmissions[assignment.id]) {
                const studentId = submission.userId;
                if (studentId in submissionsByStudent) {
                    submission.title = assignment.title;
                    submissionsByStudent[studentId].submissions.push(submission);
                }
            }
        }
        cache.submissionsByStudent[courseId] = submissionsByStudent;
        cache.allSubmissions[courseId]       = allSubmissions;
    }
    return [cache.submissionsByStudent[courseId], cache.allSubmissions[courseId]];
}

function getAllAssignments(studentId) {
    return cache.submissionsByStudent[studentId];
}

//  Get Assignments for the course
//  What is returned
//  cache.assignments[courseId] = [ { id: 425, dueAt: "2021-09-01T12:00:00-06:00", lockAt: "2021-09-01T12:00:00-06:00", possiblePts: 100, title: "Assignment 1", hasSubmissions: true } ]
async function getAssignments(courseId) {
    if (!cache.assignments[courseId]) {
        let tmp = await getCanvasData(`/courses/${courseId}/assignments?per_page=100`);
        let sub = tmp.map(a => { return {
            "id"             : a.id,
            "dueAt"          : a.due_at,
            "lockAt"         : a.lock_at,
            "possiblePts"    : a.points_possible,
            "title"          : a.name,
            "hasSubmissions" : a.has_submitted_submissions
            }; 
        });
        cache.assignments[courseId] = sub;
    }
    return cache.assignments[courseId];
}

//  Get Submissions by Status
//  
//  What is returned?
//  cache.submissionByStatus[assignmentId] = [ { userId: 123, grade: 90, score: 90, submittedAt: "2021-09-01T12:00:00-06:00", workflowState: "submitted", missing: false } ]
async function getSubmissions(courseId, assignmentId) {
    if (!cache.submissionByStatus[assignmentId]) {
        tmp = await getCanvasData(`/courses/${courseId}/assignments/${assignmentId}/submissions?per_page=100`);
        let sub;
        try {
            sub = tmp.map(a => { return {
                "userId"        : a.user_id,
                "grade"         : a.grade,
                "score"         : a.score,
                "submittedAt"   : a.submitted_at,
                "userId"        : a.user_id,
                "workflowState" : a.workflow_state,
                "missing"       : a.missing
            }; 
        });
        } catch (e) {
            console.log(e);
        }
        cache.submissionByStatus[assignmentId] = sub;
    }
    return cache.submissionByStatus[assignmentId];
}

// Export the function
module.exports =  { clearCache, listAnnouncements, startUp, getStudents, listTeamMembers, 
                    studentInTeam, getGroups, sendStatusLetters, listUnsubmitted, getCategories };
