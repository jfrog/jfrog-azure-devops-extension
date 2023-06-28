'use strict';
define(['TFS/DistributedTask/TaskRestClient'], (taskRestClient) => {
    let sharedConfig = VSS.getConfiguration();
    let vsoContext = VSS.getWebContext();
    if (sharedConfig) {
        // Register your extension with host through callback.
        sharedConfig.onBuildChanged((build) => {
            let taskClient = taskRestClient.getClient();

            // Create build-info div.
            // Get 'artifactoryType' attachments from build agent.
            taskClient
                .getPlanAttachments(vsoContext.project.id, 'build', build.orchestrationPlan.planId, 'artifactoryType')
                .then((taskAttachments) => {
                    let buildInfoParentDiv = $('#artifactory-build-info-parent');
                    if (taskAttachments.length > 0) {
                        let recId = taskAttachments[0].recordId;
                        let timelineId = taskAttachments[0].timelineId;
                        taskClient
                            .getAttachmentContent(
                                vsoContext.project.id,
                                'build',
                                build.orchestrationPlan.planId,
                                timelineId,
                                recId,
                                'artifactoryType',
                                'buildDetails'
                            )
                            .then((attachmentContent) => {
                                let buildDetails = JSON.parse(bufferToString(attachmentContent));
                                let buildInfoDiv = createBuildInfoDiv(buildDetails);
                                buildInfoParentDiv.append(buildInfoDiv);
                            });
                    } else {
                        let noBuildInfoDiv = createNoBuildInfoDiv();
                        buildInfoParentDiv.append(noBuildInfoDiv);
                    }
                });

            VSS.notifyLoadSucceeded();
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

        buildInfoIcon.src = 'images/artifactory-build-info.png';
        buildInfoUrlDiv.classList.add('build-info-url');
        // Supported since JFrog CLI version 2.17.0.
        if (buildDetails.buildInfoUiUrl) {
            buildInfoUrlDiv.href = buildDetails.buildInfoUiUrl;
        } else {
            // Backward compatibility - if a lower JFrog CLI version is used,
            // or for tasks that completed before the above functionality was introduced.
            buildInfoUrlDiv.href =
                stripTrailingSlash(buildDetails.artifactoryUrl) + '/webapp/builds/' + buildDetails.buildName + '/' + buildDetails.buildNumber;
        }
        buildInfoUrlDiv.text = 'Artifactory Build Info';
        buildInfoUrlDiv.target = '_blank';
        buildInfoDiv.append(buildInfoIcon);
        buildInfoDiv.append(buildInfoUrlDiv);
        return buildInfoDiv;
    }

    function createNoBuildInfoDiv() {
        let noBuildInfoDiv = document.createElement('p');
        noBuildInfoDiv.classList.add('build-info-url');
        noBuildInfoDiv.innerText = 'Build Info is not published to Artifactory';
        return noBuildInfoDiv;
    }

    function stripTrailingSlash(str) {
        return str.endsWith('/') ? str.slice(0, -1) : str;
    }
});
