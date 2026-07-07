import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Search, Image as ImageIcon, Sparkles, Trash2, Calendar, 
  Tag, ChevronDown, ChevronRight, X, ArrowLeft, Send, FileText, Check 
} from 'lucide-react';
import { analyzeNote, askAiAboutNotes } from '../utils/gemini';

interface Note {
  id: string;
  content: string;
  imagePath: string | null;
  transcription: string;
  topic: string;
  tags: string[];
  date: string;
}

interface NotesTabProps {
  geminiKey: string;
}

export default function NotesTab({ geminiKey }: NotesTabProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState<'list' | 'add' | 'ask'>('list');
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});
  
  // New Note Form State
  const [newNoteText, setNewNoteText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState('');

  // Ask AI about Notes State
  const [notesQuestion, setNotesQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAnswering, setIsAnswering] = useState(false);

  // Selected Note detail view
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load notes on mount
  useEffect(() => {
    async function loadNotes() {
      if (window.electronAPI) {
        const loadedNotes = await window.electronAPI.getNotes();
        setNotes(loadedNotes);
        
        // Auto-expand first few topics
        const topics = getUniqueTopics(loadedNotes);
        const initialExpanded: Record<string, boolean> = {};
        topics.forEach((t, i) => {
          initialExpanded[t] = i === 0; // expand first topic by default
        });
        setExpandedTopics(initialExpanded);
      }
    }
    loadNotes();
  }, []);

  const getUniqueTopics = (noteList: Note[]) => {
    const list = noteList.map(n => n.topic || 'Uncategorized');
    return Array.from(new Set(list));
  };

  const saveNotesList = async (updatedList: Note[]) => {
    setNotes(updatedList);
    if (window.electronAPI) {
      await window.electronAPI.saveNotes(updatedList);
    }
  };

  // Process image selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setSelectedImageUrl(url);
    }
  };

  // Convert File to Base64 (for Gemini API)
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleCreateNote = async () => {
    if (!newNoteText.trim() && !selectedFile) return;

    setIsAnalyzing(true);
    setAnalysisProgress('Saving resources...');

    let imagePath: string | null = null;
    let imageBase64: string | null = null;

    try {
      // 1. Save Image to local directory if selected
      if (selectedFile && window.electronAPI) {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const fileName = `${Date.now()}_${selectedFile.name.replace(/\s+/g, '_')}`;
        imagePath = await window.electronAPI.saveNoteImage(arrayBuffer, fileName);
        imageBase64 = await fileToBase64(selectedFile);
      }

      // 2. Call Gemini AI if API Key is configured to categorize and transcribe
      let transcription = '';
      let topic = 'Uncategorized';
      let tags: string[] = [];

      if (geminiKey) {
        setAnalysisProgress('AI is analyzing content & sorting...');
        try {
          const aiResult = await analyzeNote(
            newNoteText, 
            imageBase64, 
            selectedFile?.type || null, 
            geminiKey
          );
          transcription = aiResult.transcription || '';
          topic = aiResult.topic || 'Uncategorized';
          tags = aiResult.tags || [];
        } catch (aiErr) {
          console.error('Gemini sorting failed, saving without categorization:', aiErr);
        }
      } else {
        setAnalysisProgress('Saving note (AI is disabled without API Key)...');
      }

      // 3. Construct Note Object
      const newNote: Note = {
        id: Math.random().toString(36).substr(2, 9),
        content: newNoteText,
        imagePath: imagePath,
        transcription: transcription,
        topic: topic,
        tags: tags,
        date: new Date().toLocaleDateString(undefined, { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      };

      const updatedList = [newNote, ...notes];
      await saveNotesList(updatedList);

      // Auto expand the topic we just added
      setExpandedTopics(prev => ({ ...prev, [topic]: true }));

      // Clear Form
      setNewNoteText('');
      setSelectedFile(null);
      setSelectedImageUrl(null);
      setActiveView('list');
    } catch (err: any) {
      console.error(err);
      alert(`Error creating note: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress('');
    }
  };

  const handleDeleteNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this note?')) {
      const updatedList = notes.filter(n => n.id !== id);
      await saveNotesList(updatedList);
      if (selectedNote && selectedNote.id === id) {
        setSelectedNote(null);
      }
    }
  };

  const handleAskNotes = async () => {
    const question = notesQuestion.trim();
    if (!question) return;
    if (!geminiKey) {
      setAiResponse('Please configure your Gemini API Key in the Settings tab first.');
      return;
    }

    setIsAnswering(true);
    setAiResponse('');

    try {
      const response = await askAiAboutNotes(notes, question, geminiKey);
      setAiResponse(response);
    } catch (error: any) {
      console.error(error);
      setAiResponse(`Failed to query notes: ${error.message || 'Unknown error'}`);
    } finally {
      setIsAnswering(false);
    }
  };

  // Filter notes by search query
  const filteredNotes = notes.filter(note => {
    const q = searchQuery.toLowerCase();
    const contentMatch = note.content.toLowerCase().includes(q);
    const transMatch = note.transcription.toLowerCase().includes(q);
    const topicMatch = note.topic.toLowerCase().includes(q);
    const tagMatch = note.tags?.some(tag => tag.toLowerCase().includes(q));
    return contentMatch || transMatch || topicMatch || tagMatch;
  });

  // Group notes by topic
  const groupedNotes: Record<string, Note[]> = {};
  filteredNotes.forEach(note => {
    const topic = note.topic || 'Uncategorized';
    if (!groupedNotes[topic]) {
      groupedNotes[topic] = [];
    }
    groupedNotes[topic].push(note);
  });

  const toggleTopic = (topic: string) => {
    setExpandedTopics(prev => ({ ...prev, [topic]: !prev[topic] }));
  };

  return (
    <div style={styles.container}>
      {/* 1. DETAIL VIEW OVERLAY */}
      {selectedNote && (
        <div style={styles.detailOverlay} className="animate-fade-in">
          <div style={styles.detailHeader}>
            <button onClick={() => setSelectedNote(null)} style={styles.backButton}>
              <ArrowLeft size={16} style={{ marginRight: '6px' }} /> Back
            </button>
            <button onClick={(e) => { handleDeleteNote(selectedNote.id, e); setSelectedNote(null); }} style={styles.deleteNoteButton}>
              <Trash2 size={16} />
            </button>
          </div>
          <div style={styles.detailContent}>
            <div style={styles.metaRow}>
              <span style={styles.detailTopic}>{selectedNote.topic}</span>
              <span style={styles.detailDate}>
                <Calendar size={12} style={{ marginRight: '4px' }} />
                {selectedNote.date}
              </span>
            </div>
            
            {selectedNote.imagePath && (
              <div style={styles.detailImageContainer}>
                <img src={selectedNote.imagePath} alt="Note Attachment" style={styles.detailImage} />
              </div>
            )}

            <div style={styles.detailTextSection}>
              <h4 style={styles.sectionHeader}>Note Content</h4>
              <p style={styles.detailText}>{selectedNote.content || <span style={{ color: '#555' }}>No text content</span>}</p>
            </div>

            {selectedNote.transcription && (
              <div style={styles.detailTextSection}>
                <h4 style={styles.sectionHeader} className="flex-row">
                  <Sparkles size={14} color="#8b5cf6" style={{ marginRight: '6px' }} />
                  AI Image Transcription
                </h4>
                <p style={styles.transcriptionText}>{selectedNote.transcription}</p>
              </div>
            )}

            {selectedNote.tags && selectedNote.tags.length > 0 && (
              <div style={styles.tagsContainer}>
                {selectedNote.tags.map(t => (
                  <span key={t} style={styles.tag}>
                    <Tag size={10} style={{ marginRight: '4px' }} />
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. ADD NOTE VIEW */}
      {activeView === 'add' && (
        <div style={styles.formContainer} className="animate-slide-in">
          <div style={styles.formHeader}>
            <h3 style={styles.formTitle}>Add New Note</h3>
            <button onClick={() => setActiveView('list')} style={styles.closeButton}>
              <X size={18} />
            </button>
          </div>

          <div style={styles.formBody}>
            {/* Input content */}
            <textarea
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              placeholder="Write note details or describe this attachment..."
              style={styles.textarea}
              disabled={isAnalyzing}
            />

            {/* Selected image preview */}
            {selectedImageUrl && (
              <div style={styles.formImagePreviewContainer}>
                <img src={selectedImageUrl} alt="Attachment preview" style={styles.formImagePreview} />
                <button 
                  onClick={() => { setSelectedFile(null); setSelectedImageUrl(null); }} 
                  style={styles.removeImageBtn}
                  disabled={isAnalyzing}
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <div style={styles.formControls}>
              <button 
                onClick={() => fileInputRef.current?.click()} 
                style={styles.imageAttachButton}
                disabled={isAnalyzing}
              >
                <ImageIcon size={16} style={{ marginRight: '6px' }} />
                {selectedFile ? 'Change Picture' : 'Attach Picture'}
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageChange}
                accept="image/*"
                style={{ display: 'none' }}
              />

              <button
                onClick={handleCreateNote}
                disabled={(!newNoteText.trim() && !selectedFile) || isAnalyzing}
                style={{
                  ...styles.submitButton,
                  opacity: (!newNoteText.trim() && !selectedFile) || isAnalyzing ? 0.5 : 1
                }}
              >
                {isAnalyzing ? (
                  <span>Sorting Note...</span>
                ) : (
                  <>
                    <Check size={16} style={{ marginRight: '6px' }} />
                    Save Note
                  </>
                )}
              </button>
            </div>

            {isAnalyzing && (
              <div style={styles.progressContainer}>
                <div style={styles.progressSpinner} />
                <span style={styles.progressText}>{analysisProgress}</span>
              </div>
            )}

            {!geminiKey && (
              <p style={styles.warningNotice}>
                ⚠️ Gemini API key is missing. Notes will be saved under "Uncategorized" without AI sorting or image transcribing. Setup key in Settings.
              </p>
            )}
          </div>
        </div>
      )}

      {/* 3. ASK AI ABOUT NOTES VIEW */}
      {activeView === 'ask' && (
        <div style={styles.formContainer} className="animate-slide-in">
          <div style={styles.formHeader}>
            <h3 style={styles.formTitle}>Ask AI About Notes</h3>
            <button onClick={() => setActiveView('list')} style={styles.closeButton}>
              <X size={18} />
            </button>
          </div>

          <div style={styles.formBody}>
            <p style={styles.description}>
              Ask Gemini questions across all your transcribed and written notes (e.g. "What did I write about JavaScript arrays?").
            </p>

            <div style={styles.inputRow}>
              <input
                type="text"
                value={notesQuestion}
                onChange={(e) => setNotesQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAskNotes()}
                placeholder="Ask a question about your notes..."
                style={styles.notesInput}
                disabled={isAnswering}
              />
              <button 
                onClick={handleAskNotes} 
                style={styles.sendButton}
                disabled={isAnswering || !notesQuestion.trim()}
              >
                <Send size={16} />
              </button>
            </div>

            {isAnswering && (
              <div style={styles.progressContainer}>
                <div style={styles.progressSpinner} />
                <span style={styles.progressText}>Consulting notes database...</span>
              </div>
            )}

            {aiResponse && (
              <div style={styles.aiResponseBox}>
                <div style={styles.aiResponseHeader}>
                  <Sparkles size={12} style={{ marginRight: '4px' }} /> Answer
                </div>
                <div style={styles.aiResponseText}>{aiResponse}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. MAIN NOTES LIST VIEW */}
      {activeView === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
          {/* Header Search & Toolbar */}
          <div style={styles.toolbar}>
            <div style={styles.searchWrapper}>
              <Search size={14} color="#9ca3af" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes or categories..."
                style={styles.searchInput}
              />
            </div>
            
            <button 
              onClick={() => setActiveView('ask')} 
              style={styles.askAiButton}
              title="Ask AI about Notes"
            >
              <Sparkles size={15} />
            </button>
          </div>

          {/* Grouped Topics List */}
          <div style={styles.notesContainer}>
            {Object.keys(groupedNotes).length === 0 ? (
              <div style={styles.emptyContainer}>
                <FileText size={36} color="#4b5563" style={{ marginBottom: '12px' }} />
                <p style={styles.emptyText}>
                  {searchQuery ? 'No notes match your search.' : 'Your notes list is empty.'}
                </p>
                <button onClick={() => setActiveView('add')} style={styles.emptyAddButton}>
                  Create your first note
                </button>
              </div>
            ) : (
              Object.keys(groupedNotes).map(topic => (
                <div key={topic} style={styles.topicGroup}>
                  {/* Accordion Header */}
                  <div onClick={() => toggleTopic(topic)} style={styles.topicHeader}>
                    <div style={styles.topicHeaderTitle}>
                      {expandedTopics[topic] ? (
                        <ChevronDown size={16} style={{ marginRight: '6px' }} />
                      ) : (
                        <ChevronRight size={16} style={{ marginRight: '6px' }} />
                      )}
                      <span>{topic}</span>
                    </div>
                    <span style={styles.topicCount}>{groupedNotes[topic].length}</span>
                  </div>

                  {/* Accordion Content */}
                  {expandedTopics[topic] && (
                    <div style={styles.topicContent} className="animate-fade-in">
                      {groupedNotes[topic].map(note => (
                        <div 
                          key={note.id} 
                          onClick={() => setSelectedNote(note)} 
                          style={styles.noteCard}
                        >
                          <div style={styles.noteCardHeader}>
                            <span style={styles.noteCardDate}>{note.date.split(',')[0]}</span>
                            <button 
                              onClick={(e) => handleDeleteNote(note.id, e)} 
                              style={styles.noteDeleteButton}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                          <p style={styles.noteCardText}>
                            {note.content || note.transcription || 'Attachment note'}
                          </p>
                          {note.imagePath && (
                            <div style={styles.noteCardThumbnailContainer}>
                              <img src={note.imagePath} alt="Preview" style={styles.noteCardThumbnail} />
                            </div>
                          )}
                          {note.tags && note.tags.length > 0 && (
                            <div style={styles.noteCardTags}>
                              {note.tags.slice(0, 2).map(t => (
                                <span key={t} style={styles.cardTag}>#{t}</span>
                              ))}
                              {note.tags.length > 2 && <span style={styles.cardTag}>+{note.tags.length - 2}</span>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Floating Action Plus Button */}
          <button onClick={() => setActiveView('add')} style={styles.fab}>
            <Plus size={20} />
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    height: '100%',
    width: '100%',
    backgroundColor: '#0f111a',
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column' as const,
  },
  toolbar: {
    display: 'flex',
    padding: '12px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    backgroundColor: '#0a0b10',
    alignItems: 'center',
    gap: '8px',
  },
  searchWrapper: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#1b1d28',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '8px',
    padding: '4px 10px',
    gap: '8px',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    backgroundColor: 'transparent',
    color: '#f3f4f6',
    outline: 'none',
    fontSize: '12px',
    height: '24px',
  },
  askAiButton: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    color: '#a78bfa',
    borderRadius: '8px',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  notesContainer: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '12px',
  },
  emptyContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '24px',
    textAlign: 'center' as const,
    marginTop: '60px',
  },
  emptyText: {
    fontSize: '13px',
    color: '#9ca3af',
    marginBottom: '16px',
  },
  emptyAddButton: {
    backgroundColor: '#8b5cf6',
    color: '#ffffff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  topicGroup: {
    marginBottom: '10px',
    borderRadius: '10px',
    overflow: 'hidden',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    backgroundColor: 'rgba(27, 29, 40, 0.2)',
  },
  topicHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    backgroundColor: '#1b1d28',
    cursor: 'pointer',
    userSelect: 'none' as const,
  },
  topicHeaderTitle: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '13px',
    fontWeight: 600,
    color: '#f3f4f6',
  },
  topicCount: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#8b5cf6',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  topicContent: {
    padding: '10px',
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '10px',
  },
  noteCard: {
    backgroundColor: 'rgba(10, 11, 16, 0.6)',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    cursor: 'pointer',
    transition: 'transform 0.2s, border-color 0.2s',
  },
  noteCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noteCardDate: {
    fontSize: '9px',
    color: '#9ca3af',
  },
  noteDeleteButton: {
    background: 'transparent',
    border: 'none',
    color: '#9ca3af',
    cursor: 'pointer',
    opacity: 0.5,
  },
  noteCardText: {
    fontSize: '11px',
    color: '#e5e7eb',
    lineHeight: '1.4',
    maxHeight: '40px',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
  },
  noteCardThumbnailContainer: {
    height: '60px',
    borderRadius: '4px',
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.05)',
  },
  noteCardThumbnail: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
  },
  noteCardTags: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '4px',
    marginTop: 'auto',
  },
  cardTag: {
    fontSize: '8px',
    color: '#8b5cf6',
    fontWeight: 500,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    padding: '1px 4px',
    borderRadius: '4px',
  },
  fab: {
    position: 'absolute' as const,
    bottom: '16px',
    right: '16px',
    width: '46px',
    height: '46px',
    backgroundColor: '#8b5cf6',
    color: '#ffffff',
    borderRadius: '50%',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.35)',
    transition: 'transform 0.2s',
  },
  // Form container
  formContainer: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#0f111a',
    display: 'flex',
    flexDirection: 'column' as const,
    zIndex: 10,
  },
  formHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    backgroundColor: '#0a0b10',
  },
  formTitle: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#f3f4f6',
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    color: '#9ca3af',
    cursor: 'pointer',
  },
  formBody: {
    flex: 1,
    padding: '16px',
    overflowY: 'auto' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '14px',
  },
  textarea: {
    width: '100%',
    height: '120px',
    backgroundColor: '#1b1d28',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    color: '#f3f4f6',
    padding: '10px',
    outline: 'none',
    resize: 'none' as const,
    fontSize: '13px',
  },
  formImagePreviewContainer: {
    position: 'relative' as const,
    width: '100%',
    maxHeight: '180px',
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0b10',
  },
  formImagePreview: {
    maxWidth: '100%',
    maxHeight: '180px',
    objectFit: 'contain' as const,
  },
  removeImageBtn: {
    position: 'absolute' as const,
    top: '8px',
    right: '8px',
    backgroundColor: 'rgba(0,0,0,0.7)',
    color: '#ffffff',
    border: 'none',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  formControls: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '4px',
  },
  imageAttachButton: {
    backgroundColor: '#1b1d28',
    color: '#a78bfa',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    padding: '8px 14px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  submitButton: {
    backgroundColor: '#8b5cf6',
    color: '#ffffff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  progressContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '10px',
    backgroundColor: 'rgba(139,92,246,0.1)',
    borderRadius: '8px',
  },
  progressSpinner: {
    width: '14px',
    height: '14px',
    border: '2px solid rgba(139,92,246,0.2)',
    borderTop: '2px solid #8b5cf6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  progressText: {
    fontSize: '11px',
    color: '#a78bfa',
  },
  warningNotice: {
    fontSize: '11px',
    color: '#f59e0b',
    lineHeight: '1.4',
  },
  // Detail Overlay View
  detailOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#0f111a',
    display: 'flex',
    flexDirection: 'column' as const,
    zIndex: 10,
  },
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    backgroundColor: '#0a0b10',
  },
  backButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#9ca3af',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    fontSize: '13px',
  },
  deleteNoteButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#ef4444',
    cursor: 'pointer',
    padding: '4px',
  },
  detailContent: {
    flex: 1,
    padding: '16px',
    overflowY: 'auto' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  metaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailTopic: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#8b5cf6',
    backgroundColor: 'rgba(139,92,246,0.15)',
    padding: '3px 10px',
    borderRadius: '20px',
  },
  detailDate: {
    fontSize: '11px',
    color: '#9ca3af',
    display: 'flex',
    alignItems: 'center',
  },
  detailImageContainer: {
    width: '100%',
    maxHeight: '260px',
    overflow: 'hidden',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    backgroundColor: '#000',
    display: 'flex',
    justifyContent: 'center',
  },
  detailImage: {
    maxWidth: '100%',
    maxHeight: '260px',
    objectFit: 'contain' as const,
  },
  detailTextSection: {
    backgroundColor: '#1b1d28',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.03)',
  },
  sectionHeader: {
    fontSize: '11px',
    color: '#8b5cf6',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: '6px',
    display: 'flex',
    alignItems: 'center',
  },
  detailText: {
    fontSize: '13px',
    color: '#f3f4f6',
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap' as const,
  },
  transcriptionText: {
    fontSize: '12px',
    color: '#a78bfa',
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap' as const,
    backgroundColor: 'rgba(139, 92, 246, 0.05)',
    padding: '8px',
    borderRadius: '6px',
    border: '1px dashed rgba(139, 92, 246, 0.2)',
  },
  tagsContainer: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '6px',
  },
  tag: {
    fontSize: '11px',
    color: '#a78bfa',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    padding: '3px 8px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
  },
  // Ask AI about notes specific
  description: {
    fontSize: '12px',
    color: '#9ca3af',
    lineHeight: '1.5',
  },
  inputRow: {
    display: 'flex',
    gap: '8px',
    backgroundColor: '#1b1d28',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '8px',
    padding: '4px 8px',
    alignItems: 'center',
  },
  notesInput: {
    flex: 1,
    height: '36px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#f3f4f6',
    outline: 'none',
    fontSize: '13px',
  },
  sendButton: {
    border: 'none',
    borderRadius: '6px',
    backgroundColor: '#8b5cf6',
    color: '#ffffff',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  aiResponseBox: {
    backgroundColor: '#1b1d28',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '8px',
    padding: '12px',
    marginTop: '10px',
  },
  aiResponseHeader: {
    fontSize: '11px',
    color: '#a78bfa',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    marginBottom: '6px',
    textTransform: 'uppercase' as const,
  },
  aiResponseText: {
    fontSize: '12px',
    color: '#f3f4f6',
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap' as const,
  }
};
