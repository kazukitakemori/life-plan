import { MemberTabs, type MemberTabsProps } from '../shared/MemberTabs';

export type MemberLifeEventTabsProps = MemberTabsProps;

export function MemberLifeEventTabs(props: MemberLifeEventTabsProps) {
  return <MemberTabs {...props} />;
}
