const c = require('./canvas');
const { setParams, getCourseId, askQuestion, sendMessage } = require('./utilities');
const g = require('./nameGroups');

async function main() {
    await setParams();

    while (true) {
        console.log("\nMain Menu");
        console.log("0. Students in Class");
        console.log("1. Team Status");
        console.log("2. Students in Team");
        console.log("3. Review Unsubmitted");   //  ATTN:   what the diff from 3 and 8
        console.log("4. Delete old Announcements");
        console.log("6. Clear Cache");
        console.log("7. Set Colors");
        console.log("8. Send Missing Assignment Letters");  //  ATTN:  not showing scores
        console.log("9. Send Letter to 1 student"); //  ATTN:  failed
        console.log("10. Send Letters to a Class");
        console.log("11. Change School and Class");
        console.log("E(x)it");

        const choice = await askQuestion("Enter your choice: ");

        switch (choice) {
            case 'x':
                process.exit();
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
                await c.reviewUnsubmitted(getCourseId());
                break;
            case '4':
                await c.listAnnouncements(getCourseId());
                break;
            case '5':
                await g.renameGroups(getCourseId());
                break;
            case '6':
                c.clearCache();
                break;
            case '7':
                const color = await askQuestion("Enter 0-8: ");
                c.setColor(color);
                break;
            case '8':
                await c.sendStatusLetters(getCourseId());
                break;
            case '9':
                const studentId = await askQuestion("Student Id: ");
                const subject   = await askQuestion("Subject: ");
                const body      = await askQuestion("Body: ");
                await sendMessage(getCourseId(), [studentId], subject, body);
                break;
            case '10':
                const studentList   = await c.getStudents(c.courseId);
                const studentIds    = studentList.map(student => student.id);
                const classSubject  = await askQuestion("Subject: ");
                const classBody     = await askQuestion("Body: ");
                await sendMessage(getCourseId(), studentIds, classSubject, classBody);
                break;
            case '11':
                await setParams()
            default:
                console.log("Invalid choice, please try again.");
        }
    }
}

main();
