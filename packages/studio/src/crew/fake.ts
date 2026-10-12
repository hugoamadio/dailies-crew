import { FakeLlm } from '../llm/fake';
import { type CreateFacts, fakeIdeas } from './creator';
import { type DirectFacts, fakeDirection } from './director';
import { fakeScores, type JudgeFacts } from './judge';
import { fakeBriefing, type PrepareFacts } from './preparer';
import { fakeReview, type ReviewFacts } from './reviewer';
import { fakeRoute, type RouteFacts } from './router';
import { fakeScript, type ScriptFacts } from './scriptwriter';
import { fakeSocial, type SocialFacts } from './social';

/** The fake AI with an answer for every role of the crew */
export function createFakeLlm(): FakeLlm {
  return new FakeLlm({
    preparer: (facts) => fakeBriefing(facts as PrepareFacts),
    creator: (facts) => fakeIdeas(facts as CreateFacts),
    judge: (facts) => fakeScores(facts as JudgeFacts),
    scriptwriter: (facts) => fakeScript(facts as ScriptFacts),
    director: (facts) => fakeDirection(facts as DirectFacts),
    reviewer: (facts) => fakeReview(facts as ReviewFacts),
    social: (facts) => fakeSocial(facts as SocialFacts),
    'rejection-router': (facts) => fakeRoute(facts as RouteFacts),
  });
}
