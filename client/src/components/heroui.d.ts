// Loose type shim for the HeroUI v2→v3 compat layer (heroui.jsx stays JS).
// All re-exported primitives accept any props — they're thin wrappers and
// fully typing them adds no value during the migration.
import type { ReactElement } from 'react';

type AnyComp = (props: any) => ReactElement | null;

export const Card: AnyComp;
export const CardBody: AnyComp;
export const CardHeader: AnyComp;
export const Tab: AnyComp;
export const Tabs: AnyComp;
export const Button: AnyComp;
export const Input: AnyComp;
export const Textarea: AnyComp;
export const SelectItem: AnyComp;
export const Select: AnyComp;
export const Modal: AnyComp;
export const ModalContent: AnyComp;
export const ModalHeader: AnyComp;
export const ModalBody: AnyComp;
export const ModalFooter: AnyComp;
export const Chip: AnyComp;
export const Spinner: AnyComp;
export const Progress: AnyComp;
export function useDisclosure(props?: any): any;
