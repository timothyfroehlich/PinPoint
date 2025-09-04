/**
 * Global JSX type declaration for React 18+
 * This makes JSX.Element available globally without needing React imports
 */

import * as React from 'react';

declare global {
  namespace JSX {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Element extends React.ReactElement<unknown, string | React.JSXElementConstructor<unknown>> {}
    interface ElementClass extends React.Component<Record<string, unknown>> {
      render(): React.ReactNode;
    }
    interface ElementAttributesProperty { props: Record<string, unknown>; }
    interface ElementChildrenAttribute { children: Record<string, unknown>; }
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface IntrinsicAttributes extends React.Attributes {}
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface IntrinsicClassAttributes<T> extends React.ClassAttributes<T> {}
  }
}