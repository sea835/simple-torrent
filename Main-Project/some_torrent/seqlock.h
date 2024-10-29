#ifndef PTHREAD_H
#include <pthread.h>
#endif

typedef struct pthread_seqlock
{ /* TODO: implement the structure */
   pthread_mutex_t mutex;
   pthread_cond_t cond;
   int sequence;
} pthread_seqlock_t;

static inline void pthread_seqlock_init(pthread_seqlock_t *rw)
{
   /* TODO: ... */
   pthread_mutex_init(&rw->mutex, NULL);
   pthread_cond_init(&rw->cond, NULL);
   rw->sequence = 0;
}

static inline void pthread_seqlock_wrlock(pthread_seqlock_t *rw)
{
   /* TODO: ... */
   pthread_mutex_lock(&rw->mutex);
   while (rw->sequence & 1)
   {
      pthread_cond_wait(&rw->cond, &rw->mutex);
   }
}

static inline void pthread_seqlock_wrunlock(pthread_seqlock_t *rw)
{
   /* TODO: ... */
   rw->sequence++;
   pthread_cond_broadcast(&rw->cond);
   pthread_mutex_unlock(&rw->mutex);
}

static inline unsigned pthread_seqlock_rdlock(pthread_seqlock_t *rw)
{
   /* TODO: ... */
   pthread_mutex_lock(&rw->mutex);
   unsigned seq = rw->sequence;
   pthread_mutex_unlock(&rw->mutex);
   return seq;
}

static inline unsigned pthread_seqlock_rdunlock(pthread_seqlock_t *rw)
{
   /* TODO: ... */
   pthread_mutex_unlock(&rw->mutex);
   return 0;
}
