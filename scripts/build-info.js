"use strict";
define(["knockout", "TFS/DistributedTask/TaskRestClient"], function (ko, DT_Client) {
    let sharedConfig = VSS.getConfiguration();
    let vsoContext = VSS.getWebContext();
    if (sharedConfig) {
        // register your extension with host through callback
        sharedConfig.onBuildChanged(function (build) {
            let taskClient = DT_Client.getClient();
            // Get 'artifactoryType' attachments from build agent
            taskClient.getPlanAttachments(vsoContext.project.id, "build", build.orchestrationPlan.planId, "artifactoryType").then((taskAttachments) => {
                if (taskAttachments.length > 0) {
                    let recId = taskAttachments[0].recordId;
                    let timelineId = taskAttachments[0].timelineId;
                    taskClient.getAttachmentContent(vsoContext.project.id, "build", build.orchestrationPlan.planId, timelineId, recId, "artifactoryType", "buildDetails").then((attachementContent) => {
                        let buildDetails = JSON.parse(bufferToString(attachementContent));
                        let buildInfoDiv = createBuildInfoDiv(buildDetails);
                        $("#artifactory-build-info").append(buildInfoDiv);
                        VSS.notifyLoadSucceeded();
                    });
                }
            });
        });
    }

    function bufferToString(buffer) {
        let obj = new Uint8Array(buffer);
        return String.fromCharCode.apply(String, obj);
    }

    /**
     * Create a div element with build-info icon and <buildname>/<buildnumber> with hyperlink to Artifactory.
     * @param buildDetails - Contains 'artifactoryUrl', 'buildName' and 'buildNumber'
     */
    function createBuildInfoDiv(buildDetails) {
        let buildInfoDiv = document.createElement('div');
        let buildInfoIcon = document.createElement('img');
        let buildInfoUrlDiv = document.createElement('a');

        buildInfoIcon.src = "images/artifactory-build-info.png";
        buildInfoUrlDiv.classList.add("build-info-url");
        buildInfoUrlDiv.href = buildDetails.artifactoryUrl + '/webapp/builds/' + buildDetails.buildName + '/' + buildDetails.buildNumber;
        buildInfoUrlDiv.text = "Artifactory Build Info";
        buildInfoUrlDiv.target = "_blank";
        buildInfoDiv.append(buildInfoIcon);
        buildInfoDiv.append(buildInfoUrlDiv);
        return buildInfoDiv;
    }
});