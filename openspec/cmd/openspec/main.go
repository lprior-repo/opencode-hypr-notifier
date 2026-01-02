package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"github.com/openspec/openspec"
)

func main() {
	// Flags
	dbPath := flag.String("db", defaultDBPath(), "Path to database")
	flag.Parse()

	// Get intent from args
	args := flag.Args()
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "Usage: openspec [flags] <intent>")
		fmt.Fprintln(os.Stderr, "")
		fmt.Fprintln(os.Stderr, "Example:")
		fmt.Fprintln(os.Stderr, "  openspec \"Add user authentication with email/password\"")
		fmt.Fprintln(os.Stderr, "")
		fmt.Fprintln(os.Stderr, "Flags:")
		flag.PrintDefaults()
		os.Exit(1)
	}

	intent := args[0]

	// Initialize store
	store, err := openspec.NewSQLiteStore(*dbPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to open database: %v\n", err)
		os.Exit(1)
	}
	defer store.Close()

	// Initialize AI client (placeholder)
	ai := &mockAIClient{}

	// Create engine
	engine := openspec.NewEngine(ai, store)

	// Run
	ctx := context.Background()
	fmt.Println("OpenSpec: Contract-First Development")
	fmt.Println("=====================================")
	fmt.Println()
	fmt.Printf("Intent: %s\n\n", intent)

	fmt.Println("Phase 1: Compiling contracts...")
	specResult, err := engine.Spec(ctx, intent)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Spec failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("  Generated %d contracts\n", len(specResult.Contracts))
	for _, c := range specResult.Contracts {
		fmt.Printf("    - %s (%d invariants)\n", c.Name, len(c.Invariants))
	}

	fmt.Printf("\n  Decomposed into %d beads\n", len(specResult.Beads))
	for _, b := range specResult.Beads {
		fmt.Printf("    - %s (%s)\n", b.Name, b.Size)
	}

	fmt.Println("\nPhase 2: Executing beads...")
	result, err := engine.Execute(ctx, specResult.Spec.ID)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Execute failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Println()
	for _, r := range result.Results {
		status := "✓"
		if !r.Verification.Passed {
			status = "✗"
		}
		fmt.Printf("  [%s] %s (attempt %d/%d)\n",
			status, r.Bead.Name, r.SuccessfulIdx+1, r.Attempts)
	}

	fmt.Println()
	if result.AllPassed {
		fmt.Println("Result: ALL BEADS VERIFIED ✓")
	} else {
		fmt.Printf("Result: %d FAILURES ✗\n", len(result.Failures))
		for _, f := range result.Failures {
			fmt.Printf("  - %s: %s\n", f.Bead.Name, f.Message)
		}
	}
}

func defaultDBPath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return "openspec.db"
	}
	dir := filepath.Join(home, ".config", "openspec")
	os.MkdirAll(dir, 0755)
	return filepath.Join(dir, "openspec.db")
}

// mockAIClient is a placeholder AI client for demonstration.
// Replace with actual API client.
type mockAIClient struct{}

func (m *mockAIClient) Complete(ctx context.Context, prompt string) (string, error) {
	// This is a mock - in production, call actual AI API
	// For now, return mock data based on prompt patterns
	return `[{
		"name": "User",
		"description": "A person who uses the system",
		"operations": ["create", "authenticate"],
		"properties": ["id", "email", "password_hash"]
	}]`, nil
}
