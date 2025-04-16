x = {
 reset     : "\x1b[0m",
 bright    : "\x1b[1m",
 dim       : "\x1b[2m",
 underscore: "\x1b[4m",
 blink     : "\x1b[5m",
 reverse   : "\x1b[7m",
 hidden    : "\x1b[8m",
 fgBlack   : "\x1b[30m",
 fgRed     : "\x1b[31m",
 fgGreen   : "\x1b[32m",
 fgYellow  : "\x1b[33m",
 fgBlue    : "\x1b[34m",
 fgMagenta : "\x1b[35m",
 fgCyan    : "\x1b[36m",
 fgWhite   : "\x1b[37m",
 bgBlack   : "\x1b[40m",
 bgRed     : "\x1b[41m",
 bgGreen   : "\x1b[42m",
 bgYellow  : "\x1b[43m",
 bgBlue    : "\x1b[44m",
 bgMagenta : "\x1b[45m",
 bgCyan    : "\x1b[46m",
 bgWhite   : "\x1b[47m",

 fgBBlack   : "\x1b[90m",
 fgBRed     : "\x1b[91m",
 fgBGreen   : "\x1b[92m",
 fgBYellow  : "\x1b[93m",
 fgBBlue    : "\x1b[94m",
 fgBMagenta : "\x1b[95m",
 fgBCyan    : "\x1b[96m",
 fgBWhite   : "\x1b[97m",
 bgBBlack   : "\x1b[100m",
 bgBRed     : "\x1b[101m",
 bgBGreen   : "\x1b[102m",
 bgBYellow  : "\x1b[103m",
 bgBBlue    : "\x1b[104m",
 bgBMagenta : "\x1b[105m",
 bgBCyan    : "\x1b[106m",
 bgBWhite   : "\x1b[107m"
};

let row = 0;
function rowColor(inc=0) {
    row = row + 1 + inc;
    let rowbgColor = row % 2 ? x.reset : x.bgBWhite;
    let rowfgColor = row % 2 ? x.reset : x.fgBlue;
    return rowbgColor+rowfgColor;
}

module.exports = {x, rowColor}