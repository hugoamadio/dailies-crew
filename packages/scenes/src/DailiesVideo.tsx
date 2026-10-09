import { musicVolumeAt, type ResolvedPlan, TAIL_FRAMES } from '@dailies-crew/plan';
import { Audio } from '@remotion/media';
import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { AbsoluteFill, Sequence, staticFile } from 'remotion';
import { Captions } from './captions/Captions';
import { SceneFrame } from './SceneFrame';
import { EASE_IN_OUT } from './theme/motion';
import { BrandProvider } from './theme/brand';
import { presentationFor } from './transitions';

export type DailiesVideoProps = { plan: ResolvedPlan };

/** Plays a resolved plan: the scenes and their transitions, the voice lines, the music and the captions */
export const DailiesVideo: React.FC<DailiesVideoProps> = ({ plan }) => {
  const { music } = plan;
  return (
    <BrandProvider brand={plan.brand}>
      <AbsoluteFill style={{ backgroundColor: plan.brand.colors.background }}>
        <TransitionSeries>
          {plan.scenes.flatMap((scene) => {
            const items = [
              <TransitionSeries.Sequence key={scene.id} durationInFrames={scene.durationInFrames}>
                <SceneFrame scene={scene} durationInFrames={scene.durationInFrames} />
              </TransitionSeries.Sequence>,
            ];
            if (scene.transitionOut) {
              items.push(
                <TransitionSeries.Transition
                  key={`${scene.id}-out`}
                  presentation={presentationFor(scene.transitionOut)}
                  timing={linearTiming({
                    durationInFrames: scene.transitionOut.frames,
                    easing: EASE_IN_OUT,
                  })}
                />,
              );
            }
            return items;
          })}
        </TransitionSeries>
        {plan.voice.map((line) => (
          <Sequence
            key={line.lineId}
            from={line.from}
            durationInFrames={line.durationInFrames + TAIL_FRAMES}
          >
            <Audio src={staticFile(line.src)} />
          </Sequence>
        ))}
        {music ? (
          <Audio
            src={staticFile(music.src)}
            loop
            loopVolumeCurveBehavior="extend"
            volume={(frame) => musicVolumeAt(frame, plan.voice, music, plan.durationInFrames)}
          />
        ) : null}
        {plan.captions.enabled ? (
          <Captions words={plan.captions.words} position={plan.captions.position} />
        ) : null}
      </AbsoluteFill>
    </BrandProvider>
  );
};
