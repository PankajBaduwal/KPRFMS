import React, { useState } from 'react';
import {
  Button,
  Input,
  Select,
  MultiSelect,
  DatePicker,
  Modal,
  Drawer,
  Dropdown,
  Tabs,
  TabPanel,
  Table,
  Pagination,
  Badge,
  Alert,
  Tooltip,
  Breadcrumb,
  EmptyState,
  LoadingState,
  Skeleton,
  SkeletonCard,
  ConfirmationDialog,
  FileUploader,
  Timeline,
  Stat,
  ChartContainer,
  Search,
  FilterBar,
  PageHeader,
  useToast,
} from '../components';
import { PRODUCT_NAME } from '../config/brand';

export const DesignSystemPage: React.FC = () => {
  const { addToast } = useToast();

  // Component States
  const [activeTab, setActiveTab] = useState('inputs');
  const [inputValue, setInputValue] = useState('');
  const [selectValue, setSelectValue] = useState('cse');
  const [multiSelectValue, setMultiSelectValue] = useState<string[]>(['naac', 'nba']);
  const [dateValue, setDateValue] = useState('2026-10-05');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [tableSortField, setTableSortField] = useState('name');
  const [tableSortDir, setTableSortDir] = useState<'asc' | 'desc'>('asc');
  const [alertDismissed, setAlertDismissed] = useState(false);

  // DEV PREVIEW SAMPLE ROWS — illustrative only, not institutional data
  const sampleFaculty = [
    { id: '1', empId: 'SAMPLE-01', name: 'Sample Faculty A', dept: 'DEPT-A', designation: 'Professor', role: 'ADMIN' },
    { id: '2', empId: 'SAMPLE-02', name: 'Sample Faculty B', dept: 'DEPT-A', designation: 'Professor', role: 'PRINCIPAL' },
    { id: '3', empId: 'SAMPLE-03', name: 'Sample Faculty C', dept: 'DEPT-B', designation: 'Professor', role: 'DEAN' },
    { id: '4', empId: 'SAMPLE-04', name: 'Sample Faculty D', dept: 'DEPT-A', designation: 'Professor & HOD', role: 'HOD' },
    { id: '5', empId: 'SAMPLE-05', name: 'Sample Faculty E', dept: 'DEPT-A', designation: 'Associate Professor', role: 'FACULTY' },
  ];

  return (
    <div className="container-fluid py-4" style={{ maxWidth: '1200px' }}>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Alert variant="warning">
          Development preview: every table, chart and timeline on this page uses illustrative sample values, not institutional records. This page is not included in production builds.
        </Alert>
      </div>
      {/* 27. PageHeader */}
      <PageHeader
        title="Institutional Design System"
        subtitle={`Complete reusable component library for ${PRODUCT_NAME}`}
        breadcrumbs={
          // 16. Breadcrumb
          <Breadcrumb
            items={[
              { label: 'Portal', href: '/portal', icon: 'bi-grid-fill' },
              { label: 'Design System' },
            ]}
          />
        }
        badge={<Badge variant="primary" dot size="md">Phase 31 Verified</Badge>}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant="outline"
              size="sm"
              icon={<i className="bi bi-bell" />}
              onClick={() => addToast('Notification test triggered!', 'info')}
            >
              Trigger Toast
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<i className="bi bi-window" />}
              onClick={() => setIsModalOpen(true)}
            >
              Open Modal
            </Button>
          </div>
        }
      />

      {/* 26. FilterBar & 25. Search */}
      <FilterBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Filter components..."
        activeCount={searchQuery ? 1 : 0}
        onReset={() => setSearchQuery('')}
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={<i className="bi bi-layout-sidebar-inset-reverse" />}
            onClick={() => setIsDrawerOpen(true)}
          >
            Open Drawer
          </Button>
        }
      />

      {/* 13. Alert */}
      {!alertDismissed && (
        <div className="mb-4">
          <Alert
            variant="info"
            title="Institutional Design System Active"
            onDismiss={() => setAlertDismissed(true)}
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => addToast('Acknowledged system guidelines', 'success')}
              >
                Acknowledge
              </Button>
            }
          >
            All 27 components adhere to the institutional design tokens, accessible WCAG 2.1 AA standards, and consistent border-spaced aesthetics.
          </Alert>
        </div>
      )}

      {/* 23. Stat Cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-3">
          <Stat
            label="Total Components"
            value="27"
            unit="items"
            trend={{ value: '100%', direction: 'up', label: 'complete' }}
            icon="bi-boxes"
          />
        </div>
        <div className="col-12 col-md-3">
          <Stat
            label="Design Tokens"
            value="52"
            unit="variables"
            icon="bi-palette"
            subtitle="Variables & typography"
          />
        </div>
        <div className="col-12 col-md-3">
          <Stat
            label="Accessibility Score"
            value="100%"
            trend={{ value: 'WCAG', direction: 'up', label: 'compliant' }}
            icon="bi-universal-access"
          />
        </div>
        <div className="col-12 col-md-3">
          <Stat
            label="Regression Passes"
            value="332"
            unit="tests"
            trend={{ value: '+52', direction: 'up', label: 'Phase 30' }}
            icon="bi-shield-check"
          />
        </div>
      </div>

      {/* 9. Tabs */}
      <Tabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'inputs', label: 'Inputs & Form Controls', icon: 'bi-input-cursor-text', badge: 5 },
          { id: 'actions', label: 'Buttons, Badges & Overlays', icon: 'bi-cursor-fill', badge: 7 },
          { id: 'data', label: 'Data Display & Tables', icon: 'bi-table', badge: 5 },
          { id: 'feedback', label: 'Feedback & States', icon: 'bi-info-circle', badge: 6 },
          { id: 'upload', label: 'Upload & Timeline', icon: 'bi-cloud-arrow-up', badge: 4 },
        ]}
      >
        {/* TAB 1: INPUTS */}
        <TabPanel id="inputs" activeTab={activeTab}>
          <div className="row g-4">
            <div className="col-12 col-md-6">
              <div className="card-custom">
                <h4 className="card-title">Text Inputs & Selects</h4>
                {/* 2. Input */}
                <Input
                  label="Faculty Name"
                  placeholder="Enter full name..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onClear={() => setInputValue('')}
                  prefixIcon={<i className="bi bi-person" />}
                  hint="Institutional formal display name"
                />

                <Input
                  label="Invalid Input Test"
                  value="invalid_format"
                  error="Special characters are not allowed"
                  prefixIcon={<i className="bi bi-exclamation-triangle" />}
                />

                {/* 3. Select */}
                <Select
                  label="Department Selection"
                  value={selectValue}
                  onChange={(e) => setSelectValue(e.target.value)}
                  options={[
                    { value: 'cse', label: 'Computer Science and Engineering' },
                    { value: 'ece', label: 'Electronics and Communication Engineering' },
                    { value: 'me', label: 'Mechanical Engineering' },
                    { value: 'ce', label: 'Civil Engineering' },
                  ]}
                  hint="Select the faculty academic unit"
                />
              </div>
            </div>

            <div className="col-12 col-md-6">
              <div className="card-custom">
                <h4 className="card-title">MultiSelect & DatePicker</h4>
                {/* 4. MultiSelect */}
                <MultiSelect
                  label="Accreditation Frameworks"
                  options={[
                    { value: 'naac', label: 'NAAC Framework' },
                    { value: 'nba', label: 'NBA Criteria' },
                    { value: 'nirf', label: 'NIRF Ranking' },
                    { value: 'aacsb', label: 'AACSB Standard' },
                    { value: 'qs', label: 'QS Asia University' },
                  ]}
                  value={multiSelectValue}
                  onChange={setMultiSelectValue}
                  hint="Select multiple accreditation targets"
                />

                {/* 5. DatePicker */}
                <DatePicker
                  label="Effective Date"
                  value={dateValue}
                  onChange={setDateValue}
                  showPresets
                  hint="Select date or use quick presets"
                />

                {/* 25. Search Standalone Demo */}
                <div className="mt-3">
                  <label className="form-label-custom">Quick Global Search</label>
                  <Search
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search anything (press / or Ctrl+K)..."
                    shortcutKey="/"
                  />
                  <div className="form-hint">Type / anywhere on the page to focus</div>
                </div>
              </div>
            </div>
          </div>
        </TabPanel>

        {/* TAB 2: ACTIONS, BADGES & OVERLAYS */}
        <TabPanel id="actions" activeTab={activeTab}>
          <div className="row g-4">
            <div className="col-12 col-md-6">
              <div className="card-custom">
                <h4 className="card-title">Button Variants & Sizes</h4>
                {/* 1. Button */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                  <Button variant="primary">Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="success">Success</Button>
                  <Button variant="danger">Danger</Button>
                  <Button variant="ghost">Ghost</Button>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
                  <Button size="sm">Small</Button>
                  <Button size="md">Medium</Button>
                  <Button size="lg">Large</Button>
                  <Button loading>Loading</Button>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {/* 15. Tooltip */}
                  <Tooltip content="Export faculty dataset to Excel" position="top">
                    <Button variant="outline" size="sm" icon={<i className="bi bi-file-earmark-excel" />}>
                      Hover for Tooltip
                    </Button>
                  </Tooltip>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<i className="bi bi-trash" />}
                    onClick={() => setIsConfirmOpen(true)}
                  >
                    Open Confirmation
                  </Button>
                </div>
              </div>
            </div>

            <div className="col-12 col-md-6">
              <div className="card-custom">
                <h4 className="card-title">Badges & Dropdowns</h4>
                {/* 12. Badge */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                  <Badge variant="primary">Primary</Badge>
                  <Badge variant="success" dot>Active</Badge>
                  <Badge variant="warning" dot>Pending</Badge>
                  <Badge variant="danger">Rejected</Badge>
                  <Badge variant="info">In Review</Badge>
                  <Badge variant="neutral" onRemove={() => addToast('Removed badge', 'info')}>
                    Removable Tag
                  </Badge>
                </div>

                {/* 8. Dropdown */}
                <div>
                  <Dropdown
                    trigger={
                      <Button variant="outline" size="sm" icon={<i className="bi bi-three-dots-vertical" />}>
                        Actions Menu
                      </Button>
                    }
                    items={[
                      { label: 'View Profile', icon: 'bi-eye', onClick: () => addToast('Viewing profile', 'info') },
                      { label: 'Edit Details', icon: 'bi-pencil', onClick: () => addToast('Editing', 'info') },
                      'divider',
                      { label: 'Deactivate Account', icon: 'bi-person-x', variant: 'danger', onClick: () => setIsConfirmOpen(true) },
                    ]}
                  />
                </div>
              </div>
            </div>
          </div>
        </TabPanel>

        {/* TAB 3: DATA DISPLAY & TABLES */}
        <TabPanel id="data" activeTab={activeTab}>
          <div className="card-custom mb-4">
            <h4 className="card-title">Data Table & Pagination</h4>
            {/* 10. Table */}
            <Table
              columns={[
                { key: 'empId', header: 'Emp ID', width: '120px', sortable: true },
                { key: 'name', header: 'Faculty Member', sortable: true },
                { key: 'dept', header: 'Dept', width: '90px' },
                { key: 'designation', header: 'Designation' },
                {
                  key: 'role',
                  header: 'System Role',
                  render: (role) => (
                    <Badge variant={role === 'ADMIN' ? 'danger' : role === 'PRINCIPAL' ? 'warning' : 'primary'}>
                      {role}
                    </Badge>
                  ),
                },
              ]}
              data={sampleFaculty}
              rowKey={(r) => r.id}
              selectable
              selectedIds={selectedRowIds}
              onSelectChange={setSelectedRowIds}
              sortField={tableSortField}
              sortDirection={tableSortDir}
              onSort={(field) => {
                if (tableSortField === field) {
                  setTableSortDir(tableSortDir === 'asc' ? 'desc' : 'asc');
                } else {
                  setTableSortField(field);
                  setTableSortDir('asc');
                }
              }}
            />

            {/* 11. Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={5}
              totalItems={25}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </div>

          {/* 24. ChartContainer */}
          <ChartContainer
            title="Publication Output & Quartile Distribution"
            subtitle="Illustrative sample values (component preview only)"
            legend={[
              { label: 'Q1 Quartile', color: '#0F766E' },
              { label: 'Q2 Quartile', color: '#1B345F' },
              { label: 'Q3 Quartile', color: '#B45309' },
              { label: 'Q4 Quartile', color: '#667085' },
            ]}
          >
            <div style={{ height: '200px', display: 'flex', alignItems: 'flex-end', gap: '24px', padding: '20px 40px', justifyContent: 'space-around' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ height: '140px', width: '48px', backgroundColor: '#0F766E', borderRadius: '4px 4px 0 0' }} />
                <span style={{ fontSize: '12px', marginTop: '6px', display: 'block' }}>Q1 (42)</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ height: '90px', width: '48px', backgroundColor: '#1B345F', borderRadius: '4px 4px 0 0' }} />
                <span style={{ fontSize: '12px', marginTop: '6px', display: 'block' }}>Q2 (28)</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ height: '50px', width: '48px', backgroundColor: '#B45309', borderRadius: '4px 4px 0 0' }} />
                <span style={{ fontSize: '12px', marginTop: '6px', display: 'block' }}>Q3 (15)</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ height: '30px', width: '48px', backgroundColor: '#667085', borderRadius: '4px 4px 0 0' }} />
                <span style={{ fontSize: '12px', marginTop: '6px', display: 'block' }}>Q4 (8)</span>
              </div>
            </div>
          </ChartContainer>
        </TabPanel>

        {/* TAB 4: FEEDBACK & STATES */}
        <TabPanel id="feedback" activeTab={activeTab}>
          <div className="row g-4">
            <div className="col-12 col-md-6">
              <div className="card-custom">
                <h4 className="card-title">Empty & Loading States</h4>
                {/* 17. EmptyState */}
                <EmptyState
                  icon="bi-folder2-open"
                  title="No Documents Uploaded"
                  message="Uploaded institutional evidence and credentials will be displayed here."
                  compact
                  action={<Button variant="outline" size="sm">Upload Document</Button>}
                />

                <hr style={{ borderColor: 'var(--color-border)', margin: '20px 0' }} />

                {/* 18. LoadingState */}
                <LoadingState message="Fetching institutional telemetry..." size="md" inline />
              </div>
            </div>

            <div className="col-12 col-md-6">
              <div className="card-custom">
                <h4 className="card-title">Skeleton Shimmers</h4>
                {/* 19. Skeleton */}
                <div style={{ marginBottom: '16px' }}>
                  <Skeleton variant="text" width="60%" height={20} />
                  <Skeleton variant="text" width="100%" height={14} style={{ marginTop: '8px' }} />
                  <Skeleton variant="text" width="80%" height={14} style={{ marginTop: '4px' }} />
                </div>

                <SkeletonCard lines={2} />
              </div>
            </div>
          </div>
        </TabPanel>

        {/* TAB 5: UPLOAD & TIMELINE */}
        <TabPanel id="upload" activeTab={activeTab}>
          <div className="row g-4">
            <div className="col-12 col-md-6">
              <div className="card-custom">
                <h4 className="card-title">File Upload Zone</h4>
                {/* 21. FileUploader */}
                <FileUploader
                  label="Appraisal Evidence Submission"
                  files={uploadedFiles}
                  onFilesChange={setUploadedFiles}
                  multiple
                  hint="Drag and drop PDF certificates, max 15MB"
                />
              </div>
            </div>

            <div className="col-12 col-md-6">
              <div className="card-custom">
                <h4 className="card-title">Workflow Audit Timeline</h4>
                {/* 22. Timeline */}
                <Timeline
                  events={[
                    {
                      id: '1',
                      title: 'Publication Verified',
                      timestamp: new Date('2026-10-04T10:30:00Z'),
                      actor: 'Dr. V. Seetha (HOD)',
                      status: 'success',
                      icon: 'bi-check',
                      description: 'Scopus indexed publication verified for NIRF compliance.',
                    },
                    {
                      id: '2',
                      title: 'Correction Requested',
                      timestamp: new Date('2026-10-03T14:15:00Z'),
                      actor: 'Dean Academics',
                      status: 'warning',
                      icon: 'bi-exclamation',
                      description: 'Missing co-author affiliations in IEEE manuscript.',
                    },
                    {
                      id: '3',
                      title: 'Draft Submission Initiated',
                      timestamp: new Date('2026-10-02T09:00:00Z'),
                      actor: 'Dr. A. Karthik',
                      status: 'primary',
                      icon: 'bi-file-earmark-plus',
                      description: 'Initial draft upload of journal publication.',
                    },
                  ]}
                />
              </div>
            </div>
          </div>
        </TabPanel>
      </Tabs>

      {/* 6. Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Institutional Component Demonstration"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setIsModalOpen(false);
                addToast('Saved successfully', 'success');
              }}
            >
              Save Changes
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
          This modal dialog enforces trap focus, escape key handling, backdrop click closure, and ARIA dialog standards.
        </p>
        <Input label="Demo Parameter" placeholder="Enter test parameter..." />
      </Modal>

      {/* 7. Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Institutional System Drawer"
        position="right"
        footer={
          <Button variant="outline" size="sm" onClick={() => setIsDrawerOpen(false)}>
            Close Drawer
          </Button>
        }
      >
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
          Side-panel drawer component for secondary workflows, filters, or audit inspections without navigating away from the active screen.
        </p>
        <Select
          label="Inspector Target"
          options={[
            { value: 'audit', label: 'Audit Trail Records' },
            { value: 'telemetry', label: 'System Telemetry' },
            { value: 'security', label: 'Security Headers' },
          ]}
        />
      </Drawer>

      {/* 20. ConfirmationDialog */}
      <ConfirmationDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => {
          setIsConfirmOpen(false);
          addToast('Item successfully deleted', 'error');
        }}
        title="Delete Institutional Record?"
        message="Are you sure you want to proceed with this destructive action? This record will be permanently purged and audited."
        confirmLabel="Yes, Delete"
        variant="danger"
      />
    </div>
  );
};
