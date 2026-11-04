drop table if exists posts;
drop table if exists channel_post_audience;
alter table channels drop column if exists posts_visibility;