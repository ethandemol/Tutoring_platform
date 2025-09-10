import { syncDatabase } from '../config/database.js';
import { YouTubeTranscript } from '../models/index.js';

async function addYouTubeTranscriptsTable() {
  try {
    console.log('🔄 Creating YouTube transcripts table...');
    
    // Sync the YouTubeTranscript model to create the table
    await YouTubeTranscript.sync({ force: false });
    
    console.log('✅ YouTube transcripts table created successfully');
    
    // Test the table by creating a sample record
    const testRecord = await YouTubeTranscript.create({
      videoId: 'test-video-id',
      videoTitle: 'Test Video',
      videoDescription: 'Test Description',
      channelName: 'Test Channel',
      transcriptData: {
        video_id: 'test-video-id',
        snippets: [
          {
            text: 'Test transcript snippet',
            start: 0,
            duration: 5
          }
        ],
        total_duration: 5,
        snippet_count: 1,
        success: true
      },
      totalDuration: 5,
      snippetCount: 1,
      processedContent: 'Test processed content',
      storageType: 'database',
      accessCount: 0
    });
    
    console.log('✅ Test record created successfully');
    
    // Clean up test record
    await testRecord.destroy();
    console.log('✅ Test record cleaned up');
    
  } catch (error) {
    console.error('❌ Error creating YouTube transcripts table:', error);
    throw error;
  }
}

// Run the migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  addYouTubeTranscriptsTable()
    .then(() => {
      console.log('✅ YouTube transcripts table migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ YouTube transcripts table migration failed:', error);
      process.exit(1);
    });
}

export default addYouTubeTranscriptsTable; 