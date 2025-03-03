const { askQuestion, getCanvasData, sendMessage, sortByAttr } = require('./utilities');

const cache = {
    announcements: {},
    assignments: {},
    categories: {},
    groupMembers: {},
    groups: {},
    lastLogin: {},
    scores: {},
    students: {},
    submissionByStatus: {},
    unassigned: {},
};

function clearCache() {
    Object.keys(cache).forEach(key => cache[key] = {});
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

async function getAssignments(courseId) {
    if (!cache.assignments[courseId]) {
        cache.assignments[courseId] = await getCanvasData(`/courses/${courseId}/assignments?per_page=100`);
    }
    return cache.assignments[courseId];
}

async function getStudents(courseId) {
    if (!cache.students[courseId]) {
        cache.students[courseId] = await getCanvasData(`/courses/${courseId}/users?enrollment_type[]=student&per_page=100`);
    }
    return cache.students[courseId];
}

async function getStudent(studentId) {
    if (!cache.students[studentId]) {
        const student = await getCanvasData(`/users/${studentId}/profile`);
        cache.students[studentId] = student;
    }
    return cache.students[studentId];
}

// Fetch student profile information
async function showStudent(studentId, name) {
    const student = await getStudent(studentId);
    if (student) {
        const [lastName, rest] = student.sortable_name.split(", ");
        const firstName = rest.split(" ")[0];
        console.log(`\t- ${firstName.padEnd(10).slice(0, 10)} ${lastName.padEnd(15)} ${student.primary_email.padEnd(30)} ${student.time_zone}`);
    }
}

async function getScores(courseId) {
    if (!cache.scores[courseId]) {
        const enrollments = await getCanvasData(`/courses/${courseId}/enrollments?per_page=100&type[]=StudentEnrollment`,{"per_page": 100}); // ATTN:
        cache.scores[courseId] = enrollments?.map(student => ({
            id:             student.user_id,
            name:           student.user.name,
            firstName:      student.user.name.split(" ")[0],
            currentScore:   student.grades.current_score,
            lastActivityAt: student.last_activity_at,
            timeActive:     student.total_activity_time
    })) || [];
    }
    return cache.scores[courseId];
}

async function listTeamMembers(courseId) {
    let grpType = await askQuestion("(1) Solo, (0) All, (u) Unassigned: ");
    while (grpType.length > 0) {
        let cnt = 0;
        const courses = await getCategories(courseId);
        
        for (const course of courses) {
            console.log(`${course.name}`);
            
            if (grpType === "u") {
                const members = await getUnassigned(course.id);
                for (const member of members) {
                    await showStudent(member.id, member.name);
                }
                console.log(`${members.length} - unassigned`);
                if (await askQuestion("Email the Unassigned? (y/n): ") === 'y') {
                    const studentIds = members.map(student => student.id);
                    await sendMessage(courseId, studentIds, "You have not yet found a team", "Please identify a team that works for your schedule and add your name to the group");
                }
            } else {
                const groups = await getGroups(course.id);
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

async function studentInTeam(courseId) {
    console.log(`studentInTeam`);
    let students = [];
    const categories = await getCategories(courseId);
    
    for (const cat of categories) {
        const groups = await getGroups(cat.id);
        for (const group of groups) {
            if (group.members_count === 0) continue;
            
            const members = await getGroupMembers(group.id);
            for (const member of members) {
                const [lastName, ...theRest] = member.sortable_name.split(", ");
                const firstName = theRest.join(" ").split(" ")[0].padEnd(10).slice(0, 10);
                const student   = await getStudent(member.id);
                let   lastLogin = await getLastLogin(member.id);
                lastLogin = lastLogin || "_____TNever";
                lastLogin = lastLogin.replace('T', ' ').substring(5, 16)
                
                students.push({
                    name:  member.name,
                    first: firstName,
                    last:  lastName.padEnd(15).slice(0, 15),
                    id:    member.id,
                    login: lastLogin,
                    group: group.name.slice(0, 7),
                    email: student.primary_email.padEnd(30),
                    tz:    student.time_zone.padEnd(15).slice(0, 15)
                });
            }
        }
    }
    let group = "";
    let sortBy = await askQuestion("Sort By (first, last, group, login, email, id): ");
    while (sortBy.length > 0) {
        students = sortByAttr(students, sortBy);
        for (const student of students) {
            if (sortBy === "group" && group !== student.group) {
                console.log(`\t\t${student.group}`);
                group = student.group
            }
            switch (sortBy) {
                case    "id"    :
                    console.log(`${student.id} : ${student.first} ${student.last} : ${student.email}`);
                    break;
                case    "login"    :
                    console.log(`${student.login} : ${student.first} ${student.last} : ${student.email}`);
                    break;
                default :
                    console.log(`${student.first} ${student.last} : ${student.email} : ${student.tz}`);
                    break;
            }
        }
        sortBy = await askQuestion("Sort By (first, last, group, login, tz, email, id): ");
    }
}

async function studentsInClass(courseId) {
    let students = [];
    const studentList = await getStudents(courseId);

    for (const member of studentList) {
        const [lastName, ...rest] = member.sortable_name.split(", ");
        const firstName = rest.join(" ").split(" ")[0].padEnd(10).slice(0, 10);
        
        students.push({
            name: member.name,
            first: firstName,
            last: lastName.padEnd(15).slice(0, 15),
            id: member.id,
            email: member.email.padEnd(30)
        });
    }
    
    let sortBy = await askQuestion("Sort By (first, last, email, id): ");
    while (sortBy.length > 0) {
        students = sortByAttr(students, sortBy);
        for (const student of students) {
            if (sortBy == "id")
                console.log(`${student.first} ${student.last} : ${student.id}`);
            else
                console.log(`${student.first} ${student.last} : ${student.email}`);
        }
        sortBy = await askQuestion("Sort By (first, last, email, id): ");
    }
}

// List members in a group
async function listMembers(courseId, group, grpType) {
    console.log(`${group['name']} # in Group: ${group['members_count']}`);
    const members = await getGroupMembers(group.id);
    studentIds = members.map(member => member.id);
    if (members) {
        for (const member of members) {
            await showStudent(member.id);
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

// Get unassigned students in a group category
async function getUnassigned(groupId) {
    if (!cache.unassigned[groupId]) {
        cache.unassigned[groupId] = await getCanvasData(`/group_categories/${groupId}/users?unassigned=true&per_page=100`);
    }
    return cache.unassigned[groupId];
}

// Get group categories
async function getCategories(courseId) {
    if (!cache.categories[courseId]) {
        cache.categories[courseId] = await getCanvasData(`/courses/${courseId}/group_categories`);
    }
    return cache.categories[courseId];
}

async function sendStatusLetters(courseId) {
    const status = await getScores(courseId);
    const unfinishedAssignments = await getUnfinishedAssignments(courseId);

    await statusLetter(courseId, status, 90, 100, unfinishedAssignments,
        "Keep up the good work!: Current Score: ",
        "\nYou are doing very well in the class keep up the good work");
    await statusLetter(courseId, status, 70, 90, unfinishedAssignments,
        "You are doing well but might be missing a few assignments: Current Score: ",
        "\nYou can still turn these in until the end of week four");
    await statusLetter(courseId, status, 0, 70, unfinishedAssignments,
        "How are you doing in the class? It looks like you are struggling: Current Score: ",
        "\nHere is a list of your missing assignments. You can still turn these in until the end of week four\nDon't forget there is tutoring available for the class.");
}

async function statusLetter(courseId, status, lo, hi, unfinishedAssignments, subject, body) {
    let studentList = status.filter(student => lo < parseInt(student.currentScore) && parseInt(student.currentScore) < hi);

    let go = await askQuestion("go/no go? ");

    for( let s of studentList) {
        console.log(`${s.name} - ${s.currentScore}`);
        if (go !== "go") 
            continue;

        let missed = unfinishedAssignments[s.id]?.unsubmitted.map(a => `\t${a}`).join("\n") || "None";

        await sendMessage(courseId, 
            [s.id],
            `${subject} ${s.currentScore}`,
            `\n${s.firstName},\n${body}\nMissing Assignments (if any)\n${missed}\n\nBro. James`
        );
    };
}
async function reviewUnsubmitted(courseId) {
    const unfinishedAssignments = await getUnfinishedAssignments(courseId);
    const studentIds = new Set();

    const notify = await askQuestion("Notify?: ");
    let msg = await askQuestion("Message?: ");
    msg = msg || "\tThe Following assignments have not been submitted.\n\tThese can all be submitted up to the end of this week (Week 4)";

    for (const [studentId, info] of Object.entries(unfinishedAssignments)) {
        if (info.unsubmitted.length > 0) {
            studentIds.add(studentId);
            console.log(`${info.name.padEnd(50).slice(0, 50)} : ${studentId}`);
            for (const assignment of info.unsubmitted) {
                console.log(`    - ${assignment}`);
            }
            if (notify === "y") {
                const missed = info.unsubmitted.join("\n\t");
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
    const students    = await getStudents(courseId);
    const assignments = await getAssignments(courseId);
    
    let studentAssignments = {};
    
    // Initialize student assignments object
    students.forEach(student => {
        studentAssignments[student.id] = {
            name: student.name,
            email: student.email,
            unsubmitted: []
        };
    });

    today = new Date();
    let pastAssisgnments = assignments.filter(a => new Date(a.due_at) < today);
    // for (const assignment of assignments) {
    //     let dueDate = assignment.due_at;
    //     if (dueDate) {
    //         dueDate = new Date(dueDate);
    //         // Skip assignments that aren't past due
    //         if (dueDate > today) {
    //             console.log(`Not due yet ${assignment.name} - ${dueDate}`);
    //             continue;
    //         }
    //     }

    for (const assignment of pastAssisgnments) {
        // Fetch unsubmitted submissions
        const submissions = await getSubmissionByStatus(courseId, assignment.id, 'unsubmitted');
        for (const submission of submissions) {
            const studentId = submission.user_id;
            if (studentAssignments[studentId]) {
                studentAssignments[studentId].unsubmitted.push(assignment.name);
            }
        }
    }

    return studentAssignments;
}

async function getSubmissionByStatus(courseId, assignmentId, state) {
    if (!cache.submissionByStatus[assignmentId]) {
        cache.submissionByStatus[assignmentId] = await getCanvasData(`/courses/${courseId}/assignments/${assignmentId}/submissions?per_page=100`);
    }
    if (!cache.submissionByStatus[assignmentId])
        cache.submissionByStatus[assignmentId] = []
    
    // for (const submission of cache.submissionByStatus[assignmentId])
    //     console.log(`Not due yet: ${submission['id']} : ${submission.missing}`)

    return cache.submissionByStatus[assignmentId].filter(s => s.missing == true);
}

async function removeAnnouncements(courseId) {
    const announcements = await getAnnouncements(courseId);

    for (const announcement of announcements) {
        console.log(`${announcement.id}  ${announcement.title}`);
        const deleteChoice = await askQuestion("Delete?: ");
        if (deleteChoice === "y") {
            // const deleted = await deleteAnnouncements(courseId, announcement.id);
            console.log(`${deleted.discussion_topic.id}  ${deleted.discussion_topic.title} ${deleted.discussion_topic.workflow_state}`);
        }
    }

    const updatedAnnouncements = await getAnnouncements(courseId);
    for (const announcement of updatedAnnouncements) {
        console.log(`${announcement.id}  ${announcement.title}`);
    }
}


// Export the function
module.exports = { clearCache, getAnnouncements, listAnnouncements, getAssignments,
    getStudents, getStudent, showStudent, getScores, listTeamMembers, studentInTeam, studentsInClass, 
    listMembers, getGroups, getGroupMembers, getUnassigned, removeAnnouncements,
    sendStatusLetters, reviewUnsubmitted, getLastLogin, getUnfinishedAssignments, getCategories
};
