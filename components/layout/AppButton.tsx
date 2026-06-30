"use client";

import { Button } from "antd";
import type { ButtonProps } from "antd";

/** Single control size used app-wide (forms, toolbars, table actions). */
export const APP_CONTROL_SIZE = "large" as const;

export function PrimaryButton(props: ButtonProps) {
  return <Button type="primary" size={APP_CONTROL_SIZE} {...props} />;
}

export function SecondaryButton(props: ButtonProps) {
  return <Button size={APP_CONTROL_SIZE} {...props} />;
}

export function TextButton(props: ButtonProps) {
  return <Button type="text" size={APP_CONTROL_SIZE} {...props} />;
}

export function LinkButton(props: ButtonProps) {
  return <Button type="link" size={APP_CONTROL_SIZE} {...props} />;
}
