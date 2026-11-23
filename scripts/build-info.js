/* eslint-env browser, amd */
/* global VSS, $ */
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
                                'buildDetails',
                            )
                            .then((attachmentContent) => {
                                try {
                                    let buildDetails = JSON.parse(bufferToString(attachmentContent));
                                    buildInfoParentDiv.append(createBuildInfoDiv(buildDetails));
                                } catch {
                                    buildInfoParentDiv.append(createNoBuildInfoDiv());
                                }
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
        let destination;
        try {
            const platform = new URL(buildDetails.artifactoryUrl);
            destination = new URL(
                buildDetails.buildInfoUiUrl ||
                    stripTrailingSlash(buildDetails.artifactoryUrl) +
                        '/webapp/builds/' +
                        encodeURIComponent(buildDetails.buildName) +
                        '/' +
                        encodeURIComponent(buildDetails.buildNumber),
            );
            // Preserve HTTP for existing on-prem installations, but never accept
            // executable schemes, embedded credentials or a different origin.
            if (
                !['https:', 'http:'].includes(destination.protocol) ||
                destination.username ||
                destination.password ||
                platform.username ||
                platform.password ||
                destination.origin !== platform.origin
            ) {
                return createNoBuildInfoDiv();
            }
        } catch {
            return createNoBuildInfoDiv();
        }
        let buildInfoDiv = document.createElement('div');
        let buildInfoIcon = document.createElement('img');
        let buildInfoUrlDiv = document.createElement('a');

        buildInfoIcon.src = 'images/artifactory-build-info.png';
        buildInfoUrlDiv.classList.add('build-info-url');
        buildInfoUrlDiv.href = destination.href;
        // Attachments are build-produced data, not an authenticated URL source.
        buildInfoUrlDiv.text = 'Artifactory Build Info (' + destination.host + ')';
        buildInfoUrlDiv.target = '_blank';
        buildInfoUrlDiv.rel = 'noopener noreferrer';
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
