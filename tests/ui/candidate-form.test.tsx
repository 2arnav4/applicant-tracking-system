import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CandidateForm } from "@/features/candidates/candidate-form";
import { ApiError } from "@/lib/api-client";

const JOB_ID = "11111111-1111-4111-8111-111111111111";

function renderForm(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <CandidateForm submitLabel="Add candidate" onSubmit={onSubmit} onCancel={vi.fn()} />
    </QueryClientProvider>,
  );
  return { onSubmit, user: userEvent.setup() };
}

beforeEach(() => {
  // The job picker loads /api/jobs.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json([{ id: JOB_ID, title: "Frontend Engineer", status: "open", candidateCount: 0, activeCount: 0, hiredCount: 0 }]),
    ),
  );
});

describe("CandidateForm", () => {
  it("shows field errors and does not submit when required fields are invalid", async () => {
    const { onSubmit, user } = renderForm();
    await user.click(screen.getByRole("button", { name: "Add candidate" }));

    expect(await screen.findByText("Name must be at least 2 characters")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email")).toBeInTheDocument();
    expect(screen.getByLabelText(/Full name/)).toHaveAttribute("aria-invalid", "true");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits normalized values: lowercased email, parsed skills, nulls for blanks", async () => {
    const { onSubmit, user } = renderForm();
    await user.type(screen.getByLabelText(/Full name/), "Asha Rao");
    await user.type(screen.getByLabelText(/Email/), "Asha@Example.com");
    await user.type(screen.getByLabelText(/Skills/), "React, node.js , react,,");
    await user.type(screen.getByLabelText(/Experience/), "3");
    await screen.findByRole("option", { name: "Frontend Engineer" });
    await user.selectOptions(screen.getByLabelText(/Applying for/), JOB_ID);
    await user.click(screen.getByRole("button", { name: "Add candidate" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      name: "Asha Rao",
      email: "asha@example.com",
      skills: ["React", "node.js"],
      experienceYears: 3,
      jobId: JOB_ID,
      phone: null,
      rating: null,
      linkedinUrl: null,
    });
  });

  it("shows a server conflict (duplicate email) on the email field", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiError(409, "CONFLICT", "A candidate with this email already exists"));
    const { user } = renderForm(onSubmit);
    await user.type(screen.getByLabelText(/Full name/), "Asha Rao");
    await user.type(screen.getByLabelText(/Email/), "asha@example.com");
    await user.click(screen.getByRole("button", { name: "Add candidate" }));

    expect(await screen.findByText("A candidate with this email already exists")).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toHaveAttribute("aria-invalid", "true");
  });
});
