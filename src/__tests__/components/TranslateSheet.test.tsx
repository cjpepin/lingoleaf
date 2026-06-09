import React from 'react';
import { render } from '@testing-library/react-native';
import { TranslateSheet } from '@/components/TranslateSheet';

jest.mock('@/components/ads/AdBanner', () => ({
  AdBanner: () => null,
}));

describe('TranslateSheet', () => {
  const baseProps = {
    visible: true,
    term: 'hola',
    translation: 'hello',
    loading: false,
    error: null,
    onSave: jest.fn(),
    onClose: jest.fn(),
  };

  it('shows create-list CTA when below max list count', () => {
    const { getByText } = render(
      <TranslateSheet
        {...baseProps}
        listPickerVisible={true}
        lists={[{ id: '1', user_id: 'u', name: 'List 1', created_at: '', updated_at: '', last_used_at: null }]}
        selectedListId={'1'}
        onPickList={jest.fn()}
        onCloseListPicker={jest.fn()}
        maxListsReached={false}
      />
    );

    expect(getByText('+ Create New List')).toBeTruthy();
  });

  it('shows list-limit message instead of create CTA when max is reached', () => {
    const { getByText, queryByText } = render(
      <TranslateSheet
        {...baseProps}
        listPickerVisible={true}
        lists={[{ id: '1', user_id: 'u', name: 'List 1', created_at: '', updated_at: '', last_used_at: null }]}
        selectedListId={'1'}
        onPickList={jest.fn()}
        onCloseListPicker={jest.fn()}
        maxListsReached={true}
      />
    );

    expect(getByText('List limit reached (max 5)')).toBeTruthy();
    expect(queryByText('+ Create New List')).toBeNull();
  });
});
