import React from 'react';
import { render } from '@testing-library/react-native';
import { FocusPackCard } from '@/components/FocusPackCard';
import type { StudyPack } from '@/study/focusPack';

function makePack(overrides?: Partial<StudyPack>): StudyPack {
  return {
    id: 'focus_hash',
    listId: null,
    mode: 'focus_pack',
    wordIds: ['w1', 'w2'],
    targetCount: 10,
    reviewCount: 7,
    newCount: 3,
    title: "Today's Focus Pack",
    coachLine: '7 review cards, 3 new cards.',
    createdAt: '2026-04-05T12:00:00.000Z',
    expiresAt: '2026-04-06T12:00:00.000Z',
    ...overrides,
  };
}

describe('FocusPackCard', () => {
  it('hides the footer mix label when the pack is using fallback metadata', () => {
    const { getByText, queryByText } = render(
      <FocusPackCard
        pack={makePack({ metadataSource: 'fallback', metadataFallbackReason: 'missing_openai_api_key' })}
        caption="Focus pack"
        buttonLabel="Start pack"
        metaText="7 review · 3 new"
        onPress={jest.fn()}
      />,
    );

    expect(getByText("Today's Focus Pack")).toBeTruthy();
    expect(queryByText('7 review cards, 3 new cards.')).toBeNull();
    expect(getByText('7 review · 3 new')).toBeTruthy();
  });

  it('keeps the footer mix label when the pack has AI metadata', () => {
    const { getByText } = render(
      <FocusPackCard
        pack={makePack({
          metadataSource: 'ai',
          coachLine: 'Mostly review today, with 3 new words from your latest reading.',
        })}
        caption="Focus pack"
        buttonLabel="Start pack"
        metaText="7 review · 3 new"
        onPress={jest.fn()}
      />,
    );

    expect(getByText('Mostly review today, with 3 new words from your latest reading.')).toBeTruthy();
    expect(getByText('7 review · 3 new')).toBeTruthy();
  });
});
