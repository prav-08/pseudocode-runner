var enableWarnings = true;

class Stream {
    constructor() {
        this.text = "";
        
    }

    print(text, end="\n") {
        this.text += text.toString() + end;
    }
    
    clear() {
        this.text = "";
    }

}

var out = new Stream();
var err = new Stream();

var lineNo = 0;

function error(text) {
    err.print(`ERROR (on line ${lineNo}): ` + text);
}

function warn(text) {
    if (enableWarnings) {
        err.print(`Warning (on line ${lineNo}): ` + text);
    }
}

var validTypes = [
    "INTEGER",
    "STRING",
    "BOOLEAN",
    "REAL",
]

var validOps = {
    "+":"+",
    "-":"-",
    "*":"*",
    "/":"/",
    "(":"(",
    ")":")",
    "AND":"&&",
    "OR":"||",
    "NOT": "!",
};

//Data types are created for each variable
class DataType {
    constructor(type) {
        this.type = type;
    }

    checkValidData(data, varName = "", errors = true) { // check if the string is valid data
        if (this.type == "INTEGER") {
            // Check if string data can be converted to an integer
            const num = Number(data);
            if (floor(num) !== num) {
                if (errors) warn(data + " is not an integer and will be rounded down when stored in " + varName);
            }
            return num == num; // returns false for NaN, true for valid numbers
        }
        else if (this.type == "STRING") {
            return data[0] == "\"" && data[data.length - 1] == "\""
        }
        else if (this.type == "BOOLEAN") {
            return (data === "TRUE" || data === "FALSE");
        } else if (this.type == "REAL") {
            const num = Number(data);
            return num == num;
        }
        // Default fallback for unknown/unsupported types: false
        return false;
    }

    convertStringToData(data) {
        if (this.type == "STRING") {
            return `"${data}"`;
        } else return data;
    }

    //convert data from the data storage to JS
    convertDataToJs(data) {
        if (this.type == "INTEGER") {
            // Convert string to number, then round down to integer
            return Math.floor(Number(data));
        }
        else if (this.type == "STRING") {
            return data.substring(1, data.length - 1);
        }
        else if (this.type == "BOOLEAN") {
            return (data == "TRUE");
        } else if (this.type == "REAL") {
            return Number(data);
        }
        return data;
    }

    //convert data to the data storage from JS
    convertJsToData(data) {
        if (this.type == "INTEGER") {
            return `${data}`;
        }
        else if (this.type == "STRING") {
            return `"${data}"`;
        }
        else if (this.type == "BOOLEAN") {
            if (data) {
                return "TRUE";
            } else {
                return "FALSE";
            }
        }
        else if (this.type == "REAL") {
            return `${data}`;
        }
    }

    defaultData() {
        if (this.type == "INTEGER") {
            return 0;
        }
        else if (this.type == "STRING") {
            return "";
        }
        else if (this.type == "BOOLEAN") {
            return false;
        }
    }
}

//Class for variables
class Variable {
    constructor(name, type) {
        this.name = name;
        this.type = new DataType(type);
        this.data = null;
        if (!validTypes.includes(this.type.type)) {  // Check the string, not the object!
            error("Invalid type " + this.type.type);
        }
    }

    set(data, isString = false) {
        if (isString) { // if the data isn't already Data
            data = this.type.convertStringToData(data);
        }
        if (this.type.checkValidData(data, this.name)){
            this.data = data;
        } else {
            error("Data " + data + " cannot be converted to type " + this.type.type);
        }
        
    }

    get() { // returns as the actual type
        if (this.data == null) {
            error(this.name + " was accessed before it was initialised. It has not been set a value.");
            return this.type.defaultData();
        }
        else return this.type.convertDataToJs(this.data);
    }
}

//Class for scope: default scope is called global
class Scope {
    constructor() {
        this.vars = {};
        this.subScope = null;
    }

    addVar(varName, type) {
        this.vars[varName] = new Variable(varName, type);
    }

    setVar(varName, data, isString = false) { // no convert if data is already js
        if (this.vars[varName] === undefined) {
            error("Variable '" + varName + "' is not defined. Use DECLARE first or check for typos in the name.");
            return;
        }
        this.vars[varName].set(data, isString);
    }

    getVar(varName) {
        // Check if the variable name has a key in this.vars
        if (this.vars[varName] === undefined) {
            error("Variable '" + varName + "' is not defined. Check for typos in the name.");
            return null;
        }
        return this.vars[varName].get();
    }
}

//evaluation function
function expr_to_js(expr) {
    if (expr.length == 0) {
        error("Missing expression");
        return null;
    }
    var textline = "";

    // add spaces before and after ops
    const operators = Object.keys(validOps).sort((a, b) => b.length - a.length);
    const spaces = Array(expr.length+1).fill(0);
    const marked = Array(expr.length).fill(false);
    operators.forEach(op => {
        let pos = expr.indexOf(op);

        while (pos !== -1) {
            let canSpace = true;
            for (i = pos; i < pos+op.length; i++) {
                if (marked[i]) canSpace = false;
                break;
            }
            if (canSpace) {
                spaces[pos]++;
                spaces[pos+op.length]++;
                for (i=pos; i < pos+op.length; i++) {
                    marked[i] = true;
                }
            }

            pos = expr.indexOf(op, pos+1);
        }
    })
    let newexpr = expr.substring(0, 1);
    for (i=1; i<expr.length; i++) {
        for(j=0; j<spaces[i]; j++) {
            newexpr += " ";
        }
        newexpr += expr[i];
    }
    expr = newexpr.trim();
    
    var commands = expr.split(/\s+/);
    for (i=0; i<commands.length; i++) {
        com = commands[i];
        if (!com || com.length === 0) continue;
        console.log("Command: ", com.length);
        if (validOps[com] === undefined) {
            let isData = false;
            let dtype = new DataType(validTypes[0])
            for (const type of validTypes) {
                if (type == "STRING") {
                    if (com[0] == "\"") {
                        console.log("String detected");
                        let str = com;
                        let tempallow = false;
                        if (com.length == 1) tempallow = true;
                        while ((tempallow || com[com.length-1] != "\"") && i<commands.length-1) {
                            i++;
                            com = commands[i];
                            str += " " + com;
                            tempallow = false;
                        }
                        if (tempallow || com[com.length-1] != "\"") {
                            error("String missing ending quote (\")")
                        }
                        console.log("String added: " + str);
                        textline += str + " ";
                        isData = true;
                    }
                }
                else {
                    dtype.type = type;
                    if (dtype.checkValidData(com, "", false)) {
                        isData = true;
                        textline += dtype.convertDataToJs(com).toString() + " ";
                        break;
                    }
                }
            }
            if (!isData) textline += `(globalScope.getVar("${com}")) `;
        } else {
            textline += validOps[com] + " ";
        }
    }
    console.log(textline);
    return textline;
}

//runner function
function run() {
    const code = document.getElementById("code_input").value;
    const lines = code.split(/\r?\n/);
    lineNo = 0;

    // Create global scope
    const globalScope = new Scope();

    out.clear();
    err.clear();

    for (const line of lines) {
        lineNo++;
        let commands = line.trim().split(/\s+/);

        if (commands.length === 0) continue;

        if (commands[0] == "DECLARE") {
            // Find the position of the colon (handles spaces before/after)
            const colonIndex = line.indexOf(":");

            // Extract name by finding where "DECLARE" ends
            const name = line.substring(7, colonIndex).trim();
            const type = line.substring(colonIndex + 1).trim();

            // Add the variable to global scope
            globalScope.addVar(name, type);
        }
        else if (commands[0] == "INPUT") {
            if (commands.length !== 2) {
                error("INPUT only accepts one operand, the variable");
            } else {
                // First get the value from prompt before setVar
                // Get the last non-empty line of output text as the prompt
                const outputLines = out.text.split(/\n/).filter(line => line.trim() !== "");
                const promptText = outputLines.length > 0 ? outputLines[outputLines.length - 1] : "";
                const input = prompt(promptText); // to do
                out.print(input);
                // Now set the value and display any errors immediately
                globalScope.setVar(commands[1], input, isString = true);
            }
        }
        else if (commands[0] == "OUTPUT") {
            // Get the part after "OUTPUT"
            const lineAfterOutput = line.substring(7);

            // Split by commas (keep spaces)
            const expressions = lineAfterOutput.split(",");

            // print - debug leading zero issue
            console.log("expressions:", expressions);  // raw split result

            for (const exp of expressions) {
                const jsExpr = expr_to_js(exp.trim());
                console.log("JS Expression: ", jsExpr);
                out.print(eval(jsExpr), end="");
            }
            out.print("");
        }
        // do this last
        else if (line.includes("<-")) {
            var pos = line.indexOf("<-");
            const assignVar = line.substring(0, pos).trim();
            const operand = expr_to_js(line.substring(pos+2)).trim();
            console.log("Assigning ", operand, " to ", assignVar);
            globalScope.setVar(assignVar, eval(operand));
        }
        // Update divs after each command iteration
        document.getElementById("output").textContent = out.text;
        document.getElementById("errors").textContent = err.text;
    }

    // Final update after loop completes
    document.getElementById("output").textContent = out.text;
    document.getElementById("errors").textContent = err.text;
}