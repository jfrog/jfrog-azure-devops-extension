"use strict";
define(["knockout", "TFS/DistributedTask/TaskRestClient"], function (ko, DT_Client) {
    let viewModel = new BuildInfoViewModel();
    ko.applyBindings(viewModel);
    let sharedConfig = VSS.getConfiguration();
    let vsoContext = VSS.getWebContext();
    if (sharedConfig) {
        // register your extension with host through callback
        sharedConfig.onBuildChanged(function (build) {
            let buildId = build.id;
            let buildNumber = build.buildNumber;
            if (buildId > 0) {
                let taskClient = DT_Client.getClient();
                taskClient.getPlanAttachments(vsoContext.project.id, "build", build.orchestrationPlan.planId, "artifactoryData").then((taskAttachments) => {
                    if (taskAttachments.length === 1) {
                        let recId = taskAttachments[0].recordId;
                        let timelineId = taskAttachments[0].timelineId;
                        taskClient.getAttachmentContent(vsoContext.project.id, "build", build.orchestrationPlan.planId, timelineId, recId, "artifactoryData", "artifactoryUrl").then((attachementContent) => {
                            let buildInfoUrl = arrayBufferToString(attachementContent);
                            viewModel.artifactoryBuildInfoUri(buildInfoUrl);
                            viewModel.id(build.id);
                            viewModel.number(buildNumber);
                            viewModel.isLoaded(true);
                            VSS.notifyLoadSucceeded();
                        });
                    }
                });
            }
        });
    }

    function BuildInfoViewModel() {
        this.isLoaded = ko.observable(false);
        this.id = ko.observable("");
        this.number = ko.observable("");
        this.artifactoryBuildInfoUri = ko.observable("");
    }

    function arrayBufferToString(buffer) {
        let arr = new Uint8Array(buffer);
        return String.fromCharCode.apply(String, arr);
    }
});