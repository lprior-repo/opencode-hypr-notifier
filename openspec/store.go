package openspec

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	_ "github.com/mattn/go-sqlite3"
)

// =============================================================================
// SQLITE STORE
// =============================================================================

// SQLiteStore implements Store using SQLite.
type SQLiteStore struct {
	db *sql.DB
}

// NewSQLiteStore creates a new SQLite store.
func NewSQLiteStore(path string) (*SQLiteStore, error) {
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		return nil, err
	}

	store := &SQLiteStore{db: db}
	if err := store.migrate(); err != nil {
		return nil, err
	}

	return store, nil
}

func (s *SQLiteStore) migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS intents (
		id TEXT PRIMARY KEY,
		raw TEXT NOT NULL,
		goal TEXT,
		constraints TEXT,
		context TEXT,
		created_at INTEGER
	);

	CREATE TABLE IF NOT EXISTS specs (
		id TEXT PRIMARY KEY,
		intent_id TEXT NOT NULL,
		contracts TEXT NOT NULL,
		beads TEXT NOT NULL,
		bead_order TEXT NOT NULL,
		created_at INTEGER,
		FOREIGN KEY (intent_id) REFERENCES intents(id)
	);

	CREATE TABLE IF NOT EXISTS beads (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		description TEXT,
		contract TEXT NOT NULL,
		requires TEXT,
		produces TEXT,
		size TEXT,
		status TEXT,
		created_at INTEGER
	);

	CREATE TABLE IF NOT EXISTS verifications (
		id TEXT PRIMARY KEY,
		bead_id TEXT NOT NULL,
		passed INTEGER,
		contract_checks TEXT,
		invariant_checks TEXT,
		threshold_checks TEXT,
		property_checks TEXT,
		duration_ns INTEGER,
		timestamp INTEGER,
		FOREIGN KEY (bead_id) REFERENCES beads(id)
	);

	CREATE INDEX IF NOT EXISTS idx_beads_status ON beads(status);
	CREATE INDEX IF NOT EXISTS idx_verifications_bead ON verifications(bead_id);
	`

	_, err := s.db.Exec(schema)
	return err
}

// SaveIntent saves an intent.
func (s *SQLiteStore) SaveIntent(ctx context.Context, intent Intent) error {
	constraintsJSON, _ := json.Marshal(intent.Constraints)
	contextJSON, _ := json.Marshal(intent.Context)

	_, err := s.db.ExecContext(ctx, `
		INSERT INTO intents (id, raw, goal, constraints, context, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, intent.ID, intent.Raw, intent.Goal, constraintsJSON, contextJSON, intent.CreatedAt.Unix())

	return err
}

// GetIntent retrieves an intent.
func (s *SQLiteStore) GetIntent(ctx context.Context, id string) (Intent, error) {
	var intent Intent
	var constraintsJSON, contextJSON string
	var createdAt int64

	err := s.db.QueryRowContext(ctx, `
		SELECT id, raw, goal, constraints, context, created_at
		FROM intents WHERE id = ?
	`, id).Scan(&intent.ID, &intent.Raw, &intent.Goal, &constraintsJSON, &contextJSON, &createdAt)

	if err != nil {
		return Intent{}, err
	}

	json.Unmarshal([]byte(constraintsJSON), &intent.Constraints)
	json.Unmarshal([]byte(contextJSON), &intent.Context)

	return intent, nil
}

// SaveSpec saves a spec.
func (s *SQLiteStore) SaveSpec(ctx context.Context, spec Spec) error {
	contractsJSON, _ := json.Marshal(spec.Contracts)
	beadsJSON, _ := json.Marshal(spec.Beads)
	orderJSON, _ := json.Marshal(spec.Order)

	_, err := s.db.ExecContext(ctx, `
		INSERT INTO specs (id, intent_id, contracts, beads, bead_order, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, spec.ID, spec.IntentID, contractsJSON, beadsJSON, orderJSON, spec.CreatedAt.Unix())

	return err
}

// GetSpec retrieves a spec.
func (s *SQLiteStore) GetSpec(ctx context.Context, id string) (Spec, error) {
	var spec Spec
	var contractsJSON, beadsJSON, orderJSON string
	var createdAt int64

	err := s.db.QueryRowContext(ctx, `
		SELECT id, intent_id, contracts, beads, bead_order, created_at
		FROM specs WHERE id = ?
	`, id).Scan(&spec.ID, &spec.IntentID, &contractsJSON, &beadsJSON, &orderJSON, &createdAt)

	if err != nil {
		return Spec{}, err
	}

	json.Unmarshal([]byte(contractsJSON), &spec.Contracts)
	json.Unmarshal([]byte(beadsJSON), &spec.Beads)
	json.Unmarshal([]byte(orderJSON), &spec.Order)

	return spec, nil
}

// SaveBead saves a bead.
func (s *SQLiteStore) SaveBead(ctx context.Context, bead Bead) error {
	contractJSON, _ := json.Marshal(bead.Contract)
	requiresJSON, _ := json.Marshal(bead.Requires)
	producesJSON, _ := json.Marshal(bead.Produces)

	_, err := s.db.ExecContext(ctx, `
		INSERT INTO beads (id, name, description, contract, requires, produces, size, status, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, bead.ID, bead.Name, bead.Description, contractJSON, requiresJSON, producesJSON, bead.Size, bead.Status, bead.CreatedAt.Unix())

	return err
}

// GetBead retrieves a bead.
func (s *SQLiteStore) GetBead(ctx context.Context, id string) (Bead, error) {
	var bead Bead
	var contractJSON, requiresJSON, producesJSON string
	var createdAt int64

	err := s.db.QueryRowContext(ctx, `
		SELECT id, name, description, contract, requires, produces, size, status, created_at
		FROM beads WHERE id = ?
	`, id).Scan(&bead.ID, &bead.Name, &bead.Description, &contractJSON, &requiresJSON, &producesJSON, &bead.Size, &bead.Status, &createdAt)

	if err != nil {
		return Bead{}, err
	}

	json.Unmarshal([]byte(contractJSON), &bead.Contract)
	json.Unmarshal([]byte(requiresJSON), &bead.Requires)
	json.Unmarshal([]byte(producesJSON), &bead.Produces)

	return bead, nil
}

// UpdateBeadStatus updates a bead's status.
func (s *SQLiteStore) UpdateBeadStatus(ctx context.Context, id string, status BeadStatus) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE beads SET status = ? WHERE id = ?
	`, status, id)
	return err
}

// SaveVerification saves a verification result.
func (s *SQLiteStore) SaveVerification(ctx context.Context, v Verification) error {
	contractChecksJSON, _ := json.Marshal(v.ContractChecks)
	invariantChecksJSON, _ := json.Marshal(v.InvariantChecks)
	thresholdChecksJSON, _ := json.Marshal(v.ThresholdChecks)
	propertyChecksJSON, _ := json.Marshal(v.PropertyChecks)

	id := fmt.Sprintf("%s-%d", v.BeadID, v.Timestamp.Unix())

	_, err := s.db.ExecContext(ctx, `
		INSERT INTO verifications (id, bead_id, passed, contract_checks, invariant_checks, threshold_checks, property_checks, duration_ns, timestamp)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, v.BeadID, v.Passed, contractChecksJSON, invariantChecksJSON, thresholdChecksJSON, propertyChecksJSON, v.Duration.Nanoseconds(), v.Timestamp.Unix())

	return err
}

// GetVerification retrieves the latest verification for a bead.
func (s *SQLiteStore) GetVerification(ctx context.Context, beadID string) (Verification, error) {
	var v Verification
	var contractChecksJSON, invariantChecksJSON, thresholdChecksJSON, propertyChecksJSON string
	var passed int
	var durationNs, timestamp int64

	err := s.db.QueryRowContext(ctx, `
		SELECT bead_id, passed, contract_checks, invariant_checks, threshold_checks, property_checks, duration_ns, timestamp
		FROM verifications WHERE bead_id = ? ORDER BY timestamp DESC LIMIT 1
	`, beadID).Scan(&v.BeadID, &passed, &contractChecksJSON, &invariantChecksJSON, &thresholdChecksJSON, &propertyChecksJSON, &durationNs, &timestamp)

	if err != nil {
		return Verification{}, err
	}

	v.Passed = passed == 1
	json.Unmarshal([]byte(contractChecksJSON), &v.ContractChecks)
	json.Unmarshal([]byte(invariantChecksJSON), &v.InvariantChecks)
	json.Unmarshal([]byte(thresholdChecksJSON), &v.ThresholdChecks)
	json.Unmarshal([]byte(propertyChecksJSON), &v.PropertyChecks)

	return v, nil
}

// Close closes the database.
func (s *SQLiteStore) Close() error {
	return s.db.Close()
}
