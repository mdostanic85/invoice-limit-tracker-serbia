"use client";

import { Flex, theme } from "antd";
import type { ReactNode } from "react";

interface Props {
  /** Secondary actions grouped together (import, export, toggle, etc.). */
  secondary?: ReactNode;
  /** Primary page action — one clear CTA. */
  primary?: ReactNode;
}

/** Consistent page header action layout: secondary group + primary CTA. */
export function PageHeaderActions({ secondary, primary }: Props) {
  const { token } = theme.useToken();

  return (
    <Flex
      wrap
      align="center"
      className="page-header-actions"
      gap={token.marginMD}
    >
      {secondary ? (
        <Flex
          wrap={false}
          align="center"
          className="page-header-actions__secondary"
          gap={token.marginSM}
        >
          {secondary}
        </Flex>
      ) : null}
      {primary ? (
        <Flex className="page-header-actions__primary" flex="none">
          {primary}
        </Flex>
      ) : null}
    </Flex>
  );
}
