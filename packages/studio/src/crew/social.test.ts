import { describe, expect, it } from 'vitest';
import { expectApiSchema } from '../../test/api-schema';
import { idea, lamp, recipe, roles } from '../../test/crew-fixtures';
import { script } from '../../test/direction-fixtures';
import { FakeLlm } from '../llm/fake';
import { buildSocialRequest, fakeSocial, type SocialFacts, SocialSchema } from './social';

const facts: SocialFacts = { recipe, rules: [], material: lamp, idea, script };

describe('the social media manager', () => {
  it('answers in a schema the API accepts, one post per network', () => {
    expectApiSchema(SocialSchema);
    expect(Object.keys(SocialSchema.shape)).toEqual(['youtube', 'tiktok', 'instagram', 'facebook']);
  });

  it('wants hashtags written as #word', () => {
    const post = { title: 't', description: 'd', hashtags: ['#lua'] };
    const posts = { youtube: post, tiktok: post, instagram: post, facebook: post };
    expect(SocialSchema.safeParse(posts).success).toBe(true);
    expect(
      SocialSchema.safeParse({ ...posts, tiktok: { ...post, hashtags: ['lua lamp'] } }).success,
    ).toBe(false);
  });

  it('has fake posts that fit the schema, tagged with the product name', async () => {
    const llm = new FakeLlm({ social: (input) => fakeSocial(input as SocialFacts) });
    const { data } = await llm.generate(buildSocialRequest(facts, roles.social));
    expect(data.instagram.hashtags).toEqual(['#luminaria', '#lua']);
  });
});
