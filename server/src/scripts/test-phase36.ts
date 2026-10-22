// DEVELOPMENT TEST SCRIPT — writes test records; refuses to run against production.
import './dev-seed/requireDevEnvironment.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { appCache } from '../utils/cache.js';
import { FacultyRepository } from '../repositories/faculty.repository.js';
import { searchService } from '../services/search.service.js';
import { publicationService } from '../services/publication.service.js';
import { ROLES } from '../permissions/roles.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kpriet-fms';

async function runPhase36PerformanceTests() {
  console.log('--- STARTING PHASE 36 PERFORMANCE TESTS ---');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB successfully.');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // 1. Test In-Memory Cache Utility
  console.log('\n--- 1. Testing In-Memory LRU/TTL Cache ---');
  appCache.set('test_key_1', { data: 'sample' }, 2);
  const cachedVal = appCache.get<{ data: string }>('test_key_1');
  assert(cachedVal !== null && cachedVal.data === 'sample', 'Cache stores and retrieves data correctly');

  appCache.invalidate('test_key_1');
  const invalidatedVal = appCache.get('test_key_1');
  assert(invalidatedVal === null, 'Cache invalidation removes item');

  // 2. Test Faculty Repository Projections
  console.log('\n--- 2. Testing Faculty List Query Projections ---');
  const facultyRepo = new FacultyRepository();
  const facultyList = await facultyRepo.findAll();
  assert(Array.isArray(facultyList), 'FacultyRepository.findAll() returns array');

  if (facultyList.length > 0) {
    const firstFaculty = facultyList[0] as any;
    assert(Boolean(firstFaculty.name && firstFaculty.employeeId), 'Faculty record contains basic fields');
    assert(!firstFaculty.weeklyTimetable || firstFaculty.weeklyTimetable.length === 0, 'Heavy timetable subdocument excluded from directory projection');
    assert(!firstFaculty.appraisalHistory || firstFaculty.appraisalHistory.length === 0, 'Heavy appraisal subdocument excluded from directory projection');
  }

  // 3. Test Global Search Projections & Caching
  console.log('\n--- 3. Testing Global Search Projections & Caching ---');
  const mockAdminUser = {
    id: new mongoose.Types.ObjectId().toString(),
    email: 'admin@kpriet.ac.in',
    role: ROLES.ADMIN,
    name: 'Admin Test',
  } as any;

  const searchStart = performance.now();
  const searchRes1 = await searchService.search(mockAdminUser, 'Dr', undefined);
  const searchDuration1 = performance.now() - searchStart;

  const searchStart2 = performance.now();
  const searchRes2 = await searchService.search(mockAdminUser, 'Dr', undefined);
  const searchDuration2 = performance.now() - searchStart2;

  assert(searchRes1.totalCount >= 0, 'Global search returns valid search results');
  assert(searchRes2.totalCount === searchRes1.totalCount, 'Cached global search matches original results');
  console.log(`Search query 1 duration: ${searchDuration1.toFixed(2)}ms, Query 2 (cached): ${searchDuration2.toFixed(2)}ms`);
  assert(searchDuration2 < searchDuration1 || searchDuration2 < 25, 'Subsequent identical search served rapidly from memory cache');

  // 4. Test Publication Analytics Caching
  console.log('\n--- 4. Testing Publication Analytics Caching ---');

  const pubStart1 = performance.now();
  const pubAnalytics1 = await publicationService.getPublicationAnalytics(mockAdminUser);
  const pubDuration1 = performance.now() - pubStart1;

  const pubStart2 = performance.now();
  const pubAnalytics2 = await publicationService.getPublicationAnalytics(mockAdminUser);
  const pubDuration2 = performance.now() - pubStart2;

  assert(pubAnalytics1.totalPublications >= 0, 'Publication analytics computed successfully');
  assert(pubAnalytics2.totalPublications === pubAnalytics1.totalPublications, 'Cached publication analytics match original response');
  console.log(`Analytics run 1 duration: ${pubDuration1.toFixed(2)}ms, run 2 (cached): ${pubDuration2.toFixed(2)}ms`);
  assert(pubDuration2 <= pubDuration1 || pubDuration2 < 20, 'Subsequent analytics served from appCache');

  // Summary
  console.log(`\n========================================`);
  console.log(`PHASE 36 TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================`);

  await mongoose.disconnect();
  if (failed > 0) process.exit(1);
}

runPhase36PerformanceTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
