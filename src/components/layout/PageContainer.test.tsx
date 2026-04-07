import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PageContainer } from "./PageContainer";

describe("PageContainer", () => {
  it("renders children", () => {
    render(<PageContainer>Hello World</PageContainer>);
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  it("applies standard size class by default", () => {
    const { container } = render(<PageContainer>content</PageContainer>);
    expect(container.firstChild).toHaveClass("max-w-6xl");
  });

  it("applies narrow size class", () => {
    const { container } = render(
      <PageContainer size="narrow">content</PageContainer>
    );
    expect(container.firstChild).toHaveClass("max-w-3xl");
  });

  it("applies wide size class", () => {
    const { container } = render(
      <PageContainer size="wide">content</PageContainer>
    );
    expect(container.firstChild).toHaveClass("max-w-7xl");
  });

  it("applies no max-width for full size", () => {
    const { container } = render(
      <PageContainer size="full">content</PageContainer>
    );
    expect(container.firstChild).not.toHaveClass("max-w-3xl");
    expect(container.firstChild).not.toHaveClass("max-w-6xl");
    expect(container.firstChild).not.toHaveClass("max-w-7xl");
  });

  it("always applies mx-auto, py-10 and space-y-6", () => {
    const { container } = render(<PageContainer>content</PageContainer>);
    expect(container.firstChild).toHaveClass("mx-auto");
    expect(container.firstChild).toHaveClass("py-10");
    expect(container.firstChild).toHaveClass("space-y-6");
  });

  it("merges additional className", () => {
    const { container } = render(
      <PageContainer className="extra-class">content</PageContainer>
    );
    expect(container.firstChild).toHaveClass("extra-class");
  });
});
