const c = require('./canvas');
const { setParams, getCourseId, askQuestion, sendMessage } = require('./utilities');
const g = require('./nameGroups');

async function main() {
    await setParams();

    while (true) {
        console.log("\nMain Menu");
        console.log("0.  Students in Class  1. Team Members       2. Students in Team");
        console.log("3. List Unsubmitted    4. Missing Assignment Letters");  //  ATTN:  not showing scores
        console.log("5. Message 1 student   6. Message Class");
        console.log("10. Set School and Class");
        console.log("E(x)it");

        const choice = await askQuestion("Enter your choice: ");

        switch (choice) {
            case '0':
                await c.studentsInClass(getCourseId());
                break;
            case '1':
                await c.listTeamMembers(getCourseId());
                break;
            case '2':
                await c.studentInTeam(getCourseId());
                break;
            case '3':
                await c.listUnsubmitted(getCourseId());
                break;
            case '4':
                await c.sendStatusLetters(getCourseId());
                break;
            case '5':
                const studentId = await askQuestion("Student Id: ");
                const subject   = await askQuestion("Subject: ");
                const body      = await askQuestion("Body: ");
                await sendMessage(getCourseId(), [studentId], subject, body);
                break;
            case '6':
                const studentList   = await c.getStudents(c.courseId);
                const studentIds    = studentList.map(student => student.id);
                const classSubject  = await askQuestion("Subject: ");
                const classBody     = await askQuestion("Body: ");
                await sendMessage(getCourseId(), studentIds, classSubject, classBody);
                break;
            // case '5':
            //     await g.renameGroups(getCourseId());
            //     break;
            case '10':
                await setParams()
            case 'x':
                process.exit();
                default:
                console.log("Invalid choice, please try again.");
        }
    }
}

main();
