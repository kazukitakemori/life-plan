import { MemberTabs, type MemberTabsProps } from '../shared/MemberTabs';

export type MemberIncomeTabsProps = MemberTabsProps;

export function MemberIncomeTabs(props: MemberIncomeTabsProps) {
  return <MemberTabs {...props} />;
}
