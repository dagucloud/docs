import { Composition } from "remotion";

import { DeploymentModelDiagram } from "./DeploymentModelDiagram";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="DeploymentLocal"
        component={DeploymentModelDiagram}
        durationInFrames={72}
        fps={24}
        width={960}
        height={540}
        defaultProps={{ model: "local" as const }}
      />
      <Composition
        id="DeploymentSelfHosted"
        component={DeploymentModelDiagram}
        durationInFrames={72}
        fps={24}
        width={960}
        height={540}
        defaultProps={{ model: "selfHosted" as const }}
      />
      <Composition
        id="DeploymentManaged"
        component={DeploymentModelDiagram}
        durationInFrames={72}
        fps={24}
        width={960}
        height={540}
        defaultProps={{ model: "managed" as const }}
      />
      <Composition
        id="DeploymentHybrid"
        component={DeploymentModelDiagram}
        durationInFrames={72}
        fps={24}
        width={960}
        height={540}
        defaultProps={{ model: "hybrid" as const }}
      />
    </>
  );
};
