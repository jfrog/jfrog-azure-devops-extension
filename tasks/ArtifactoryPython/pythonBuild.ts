import * as utils from "artifactory-tasks-utils";


function RunTaskCbk() {
    console.log("Hello World");
}
utils.executeCliTask(RunTaskCbk);
