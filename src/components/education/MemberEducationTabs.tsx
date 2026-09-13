import { MemberTabs, type MemberTabsProps } from '../shared/MemberTabs';

export type MemberEducationTabsProps = MemberTabsProps;

export function MemberEducationTabs(props: MemberEducationTabsProps) {
  return <MemberTabs {...props} />;
}
