import React from 'react';
import { Modal } from '../../components';
import { AccountImport } from '../../components/import/AccountImport';

interface FacultyImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: (created: number) => void;
}

/**
 * Bulk import of faculty and staff accounts (all roles) from the Excel/CSV template:
 * choose how existing people and departments are treated, preview every row, then import.
 * Each new account gets a "set your password" email.
 */
export const FacultyImportModal: React.FC<FacultyImportModalProps> = ({ isOpen, onClose, onImported }) => (
  <Modal isOpen={isOpen} onClose={onClose} title="Import faculty and staff" size="xl">
    <AccountImport base="/admin/users/import" templateName="faculty-import-template.xlsx" onFinished={(job) => onImported(job.created + job.updated)} />
  </Modal>
);
